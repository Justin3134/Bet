"""
BET Agent — evaluates GitHub commits against stated goals.
Deployed to Tensorlake as a serverless application.

Deploy:  tl deploy main.py
Schedule: python setup_cron.py  (registers the 30-min cron after deploy)
Run locally: python main.py
"""

import os
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

INSFORGE_URL = os.environ.get("INSFORGE_URL", "https://4vxtn8fe.us-east.insforge.app")
INSFORGE_ADMIN_KEY = os.environ.get("INSFORGE_ADMIN_KEY", "")
TENSORLAKE_API_KEY = os.environ.get("TENSORLAKE_API_KEY", "")
TENSORLAKE_ORG_ID = os.environ.get("TENSORLAKE_ORG_ID", "")

from tensorlake.applications import application, function
from evaluator import evaluate
from nia_client import query_progress, ensure_repo_indexed
from hyperspell_client import search_context


def insforge_headers() -> dict:
    return {
        "apikey": INSFORGE_ADMIN_KEY,
        "Authorization": f"Bearer {INSFORGE_ADMIN_KEY}",
        "Content-Type": "application/json",
    }


def fetch_active_bets() -> list[dict]:
    """Fetch all active bets from InsForge PostgreSQL via PostgREST."""
    resp = requests.get(
        f"{INSFORGE_URL}/rest/v1/bets",
        params={"status": "eq.active", "select": "*,users(id,clerk_id,github_access_token,insforge_user_id)"},
        headers=insforge_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def post_agent_update(bet_id: str, score: int, commits_found: int, findings: str, commit_messages: list[str], next_steps: list[str] | None = None, nia_summary: str = ""):
    """Update bet progress and insert evidence record via InsForge."""
    now = datetime.now(tz=timezone.utc).isoformat()

    # Update bet progress
    resp = requests.patch(
        f"{INSFORGE_URL}/rest/v1/bets",
        params={"id": f"eq.{bet_id}"},
        headers=insforge_headers(),
        json={
            "progress_score": score,
            "progress": score,
            "commits_found": commits_found,
            "findings": findings,
            "agent_last_run": now,
            "updated_at": now,
        },
        timeout=15,
    )
    resp.raise_for_status()

    # Insert evidence record
    resp2 = requests.post(
        f"{INSFORGE_URL}/rest/v1/evidence",
        headers=insforge_headers(),
        json={
            "bet_id": bet_id,
            "agent_version": "1.0",
            "commits_found": commits_found,
            "progress_score": score,
            "findings": findings,
            "next_steps": next_steps or [],
            "commit_messages": commit_messages[:10],
            "nia_summary": nia_summary or None,
        },
        timeout=15,
    )
    resp2.raise_for_status()


def post_verdict(bet_id: str, verdict: str, reason: str):
    """Set final verdict on a bet."""
    now = datetime.now(tz=timezone.utc).isoformat()
    resp = requests.patch(
        f"{INSFORGE_URL}/rest/v1/bets",
        params={"id": f"eq.{bet_id}"},
        headers=insforge_headers(),
        json={
            "status": verdict,
            "verdict_reason": reason,
            "updated_at": now,
        },
        timeout=15,
    )
    resp.raise_for_status()

    # Update user stats
    update_user_stats_after_verdict(bet_id, verdict)


def update_user_stats_after_verdict(bet_id: str, verdict: str):
    """Increment user hit/miss count and update total_bets."""
    try:
        # Get bet to find user_id
        resp = requests.get(
            f"{INSFORGE_URL}/rest/v1/bets",
            params={"id": f"eq.{bet_id}", "select": "user_id"},
            headers=insforge_headers(),
            timeout=10,
        )
        bets = resp.json()
        if not bets:
            return
        user_id = bets[0]["user_id"]

        # Get current user stats
        resp2 = requests.get(
            f"{INSFORGE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}", "select": "hits_count,misses_count,total_bets,current_streak"},
            headers=insforge_headers(),
            timeout=10,
        )
        users = resp2.json()
        if not users:
            return

        user = users[0]
        hits = user["hits_count"] or 0
        misses = user["misses_count"] or 0
        streak = user["current_streak"] or 0
        total = user["total_bets"] or 0

        if verdict == "hit":
            hits += 1
            streak += 1
        else:
            misses += 1
            streak = 0

        total_resolved = hits + misses
        hit_rate = hits / total_resolved if total_resolved > 0 else 0

        requests.patch(
            f"{INSFORGE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}"},
            headers=insforge_headers(),
            json={
                "hits_count": hits,
                "misses_count": misses,
                "current_streak": streak,
                "hit_rate": hit_rate,
                "total_bets": max(total, total_resolved),
            },
            timeout=10,
        )
    except Exception as e:
        print(f"  Failed to update user stats: {e}")


def fetch_github_commits(repo: str, since_ms: int, token: str | None = None) -> list[dict]:
    """Fetch commits from GitHub API since a given timestamp."""
    since_iso = datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).isoformat()
    url = f"https://api.github.com/repos/{repo}/commits"
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resp = requests.get(
        url,
        params={"since": since_iso, "per_page": 50},
        headers=headers,
        timeout=15,
    )

    if resp.status_code in (404, 401):
        print(f"  Repo {repo} not accessible (status {resp.status_code})")
        return []

    resp.raise_for_status()
    return resp.json()


def is_past_deadline(deadline_iso: str) -> bool:
    deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
    return datetime.now(tz=timezone.utc) > deadline


def evaluate_single_bet(bet: dict):
    """Evaluate a single bet: fetch commits, analyze with Claude + Nia, post results."""
    bet_id = bet["id"]
    goal = bet["goal"]
    repo = bet.get("github_repo") or ""
    created_at_iso = bet["created_at"]
    deadline_iso = bet["deadline"]

    # Get GitHub token and insforge_user_id from joined users if available
    user_data = bet.get("users") or {}
    token = user_data.get("github_access_token") or bet.get("github_access_token")
    insforge_user_id = user_data.get("insforge_user_id") or ""

    print(f"\n[{bet_id[:8]}] Evaluating: {goal[:60]}...")
    print(f"  Repo: {repo}")

    # Convert created_at to ms for GitHub since filter
    created_dt = datetime.fromisoformat(created_at_iso.replace("Z", "+00:00"))
    created_ms = int(created_dt.timestamp() * 1000)

    commits = []
    if repo:
        commits = fetch_github_commits(repo, created_ms, token)
        ensure_repo_indexed(repo, token)

    commit_messages = [
        c.get("commit", {}).get("message", "").split("\n")[0]
        for c in commits
    ]
    print(f"  Found {len(commits)} commits")

    nia_context = query_progress(goal, commit_messages, repo) if repo else ""

    hyperspell_context = search_context(goal, insforge_user_id, repo) if insforge_user_id else ""

    score, findings, next_steps = evaluate(goal, commit_messages, nia_context, hyperspell_context)
    print(f"  Score: {score}/100")
    if next_steps:
        print(f"  Next steps: {len(next_steps)} items")

    post_agent_update(
        bet_id=bet_id,
        score=score,
        commits_found=len(commits),
        findings=findings,
        commit_messages=commit_messages,
        next_steps=next_steps,
        nia_summary=nia_context,
    )

    if score >= 100:
        verdict_reason = f"Goal fully achieved. Final progress score: 100/100. {findings}"
        print(f"  Score reached 100. Verdict: HIT")
        post_verdict(bet_id, "hit", verdict_reason)
    elif is_past_deadline(deadline_iso):
        verdict = "hit" if score >= 70 else "missed"
        verdict_reason = (
            f"{'Goal achieved.' if verdict == 'hit' else 'Goal not achieved.'} "
            f"Final progress score: {score}/100. {findings}"
        )
        print(f"  Deadline passed. Verdict: {verdict.upper()}")
        post_verdict(bet_id, verdict, verdict_reason)


# ─── Tensorlake application ───────────────────────────────

@application()
@function(secrets=["INSFORGE_URL", "INSFORGE_ADMIN_KEY", "OPENAI_API_KEY", "NIA_API_KEY", "HYPERSPELL_API_KEY"])
def evaluate_all_bets():
    """
    Main entry point — called by Tensorlake cron every 30 minutes.
    Register the schedule after deploy: python setup_cron.py
    """
    print(f"\n=== BET Agent run at {datetime.now(tz=timezone.utc).isoformat()} ===")

    try:
        bets = fetch_active_bets()
        print(f"Found {len(bets)} active bets")
    except Exception as e:
        print(f"Failed to fetch bets: {e}")
        return {"error": str(e)}

    results = []
    for bet in bets:
        try:
            evaluate_single_bet(bet)
            results.append({"betId": bet.get("id"), "status": "ok"})
        except Exception as e:
            print(f"Error evaluating bet {bet.get('id')}: {e}")
            results.append({"betId": bet.get("id"), "status": "error", "error": str(e)})

    print(f"\n=== Run complete — {len(results)} bets processed ===")
    return {"processed": len(results), "results": results}


if __name__ == "__main__":
    from tensorlake.applications import run_local_application
    request = run_local_application(evaluate_all_bets)
    output = request.output()
    print(json.dumps(output, indent=2))

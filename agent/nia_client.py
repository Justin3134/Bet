"""
Nia client for BET agent.

Uses nia-ai-py SDK to index GitHub repos and query for semantic context
about how commits relate to stated goals. This gives Claude richer
signal than commit messages alone — actual code changes, file diffs,
function-level understanding.
"""

import os
import time
from typing import Optional

NIA_API_KEY = os.environ.get("NIA_API_KEY", "")

# Lazy-init SDK so import doesn't fail if nia-ai-py isn't installed
_sdk = None


def _get_sdk():
    global _sdk
    if _sdk is None:
        try:
            from nia_py.sdk import NiaSDK
            _sdk = NiaSDK(api_key=NIA_API_KEY)
        except ImportError:
            print("  [nia] nia-ai-py not installed. Run: pip install nia-ai-py")
            return None
        except Exception as e:
            print(f"  [nia] SDK init failed: {e}")
            return None
    return _sdk


def ensure_repo_indexed(repo: str, github_token: Optional[str] = None) -> bool:
    """
    Ensure a GitHub repo is indexed in Nia.
    Uses `sdk.sources.resolve` first to avoid re-indexing.
    Returns True if the source is available.
    """
    if not NIA_API_KEY:
        return False

    sdk = _get_sdk()
    if not sdk:
        return False

    try:
        # Check if already indexed
        existing = sdk.sources.resolve(identifier=repo)
        if existing:
            print(f"  [nia] Repo {repo} already indexed (id={existing.id})")
            return True
    except Exception:
        pass  # Not found — proceed to index

    # Index the repo
    try:
        repo_url = f"https://github.com/{repo}"
        print(f"  [nia] Indexing {repo_url}...")
        sdk.sources.create({"type": "repository", "url": repo_url})
        # Give Nia a moment to start indexing
        time.sleep(2)
        return True
    except Exception as e:
        print(f"  [nia] Failed to index {repo}: {e}")
        return False


def query_progress(goal: str, commits: list[str], repo: str = "") -> str:
    """
    Query Nia for semantic context about how commits relate to the goal.

    Uses sdk.search.query() with the goal as the question and the repo
    as the source — this returns actual code context (function signatures,
    file changes) that Claude can use to evaluate progress more accurately.

    Returns a context string to pass to evaluator.evaluate(), or "" if unavailable.
    """
    if not NIA_API_KEY:
        return ""

    sdk = _get_sdk()
    if not sdk:
        return ""

    if not commits and not repo:
        return ""

    try:
        # Forward-looking: ask what's MISSING, not what was done.
        # Commits are still passed as context so Nia understands what's already present.
        commits_summary = "\n".join(f"- {c}" for c in commits[:10]) if commits else "No commits yet."
        query = (
            f"Given the goal is: \"{goal}\" — what specific code, files, or features "
            f"are still MISSING from this codebase to fully achieve it? "
            f"Be concrete about what files and functions still need to be written.\n\n"
            f"Recent commits for context:\n{commits_summary}"
        )

        messages = [{"role": "user", "content": query}]
        kwargs = {"messages": messages}
        if repo:
            kwargs["repositories"] = [repo]

        results = sdk.search.query(**kwargs)

        if not results:
            return ""

        # unified_search returns a raw dict: {"answer": "...", "sources": [...]}
        if isinstance(results, dict):
            answer = results.get("answer") or ""
            sources = results.get("sources") or results.get("results") or []

            context_parts = []
            if answer:
                context_parts.append(answer[:1500])
            for r in sources[:5]:
                if isinstance(r, dict):
                    text = r.get("content") or r.get("text") or r.get("snippet") or ""
                    source = r.get("source") or r.get("file") or r.get("path") or r.get("display_name") or ""
                    if text:
                        context_parts.append(f"[{source}]\n{text[:400]}")
        elif isinstance(results, list):
            context_parts = []
            for r in results[:5]:
                if isinstance(r, dict):
                    text = r.get("content") or r.get("text") or r.get("snippet") or ""
                    source = r.get("source") or r.get("file") or r.get("path") or ""
                    if text:
                        context_parts.append(f"[{source}]\n{text[:400]}")
                elif isinstance(r, str):
                    context_parts.append(r[:400])
        else:
            return ""

        if not context_parts:
            return ""

        context = "\n\n".join(context_parts)
        print(f"  [nia] Retrieved {len(context_parts)} context chunks")
        return context

    except Exception as e:
        print(f"  [nia] Query failed: {e}")
        return ""


def index_repo(repo_url: str, github_token: Optional[str] = None) -> Optional[str]:
    """
    Index a GitHub repo into Nia. Returns source ID or None.
    Legacy interface kept for compatibility.
    """
    if not NIA_API_KEY:
        return None

    sdk = _get_sdk()
    if not sdk:
        return None

    try:
        result = sdk.sources.create({"type": "repository", "url": repo_url})
        if result is None:
            return None
        return result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
    except Exception as e:
        print(f"  [nia] index_repo failed: {e}")
        return None

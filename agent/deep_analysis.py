"""
deep_analysis.py — TensorLake sandbox-based code execution for BET agent.

This TensorLake application creates a real microVM sandbox (via Firecracker /
CloudHypervisor) that appears in the TensorLake Sandboxes dashboard. The sandbox
git-clones the target repo, runs the test suite, and writes results to InsForge.

Deploy:  tl deploy deep_analysis.py
Invoke:  POST https://api.tensorlake.ai/applications/deep_analyze_repo
         --json '{"bet_id": "...", "repo": "owner/repo", "goal": "..."}'
"""

import json
import os
import re
from datetime import datetime, timezone

from pydantic import BaseModel
from tensorlake.applications import application, function
from tensorlake.image import Image
from tensorlake.sandbox import SandboxClient

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests

# Minimal application image — only needs requests for InsForge writes.
# Git, Python, Node etc. are installed inside the sandbox itself.
_image = Image().run("pip install requests")

INSFORGE_URL = os.environ.get("INSFORGE_URL", "https://4vxtn8fe.us-east.insforge.app")
INSFORGE_ADMIN_KEY = os.environ.get("INSFORGE_ADMIN_KEY", "")


class AnalysisRequest(BaseModel):
    bet_id: str
    repo: str
    goal: str


def insforge_headers() -> dict:
    return {
        "apikey": INSFORGE_ADMIN_KEY,
        "Authorization": f"Bearer {INSFORGE_ADMIN_KEY}",
        "Content-Type": "application/json",
    }


def _parse_test_counts(output: str) -> tuple[int, int]:
    """Extract passed/failed counts from common test runner output."""
    passed = 0
    failed = 0

    # Jest / Vitest: "Tests: 3 passed, 1 failed"
    m = re.search(r"Tests?:\s*(?:(\d+)\s+passed)?.*?(?:(\d+)\s+failed)?", output)
    if m:
        passed = int(m.group(1) or 0)
        failed = int(m.group(2) or 0)

    # Pytest: "3 passed, 1 failed"
    m2 = re.search(r"(\d+)\s+passed", output)
    if m2:
        passed = int(m2.group(1))
    m3 = re.search(r"(\d+)\s+failed", output)
    if m3:
        failed = int(m3.group(1))

    # Go test: "--- FAIL" / "--- PASS"
    if "--- PASS" in output:
        passed = output.count("--- PASS")
    if "--- FAIL" in output:
        failed = output.count("--- FAIL")

    return passed, failed


def _build_summary(result: dict, goal: str) -> str:
    t = result["type"]
    if t == "file_scan":
        lines = result["raw_output"].split("\n")
        count = len([line for line in lines if line.strip()])
        return f"TensorLake cloned and scanned the repo: {count} source files found."

    if t == "clone_failed":
        return result.get("summary", "TensorLake could not clone the repo.")

    status = "passed" if result["build_success"] else "failed"
    p, f = result["tests_passed"], result["tests_failed"]
    total = p + f

    if total > 0:
        return (
            f"TensorLake executed tests in a live sandbox. "
            f"{p}/{total} tests passed ({f} failed). "
            f"Exit code: {result['exit_code']}."
        )
    if result["build_success"]:
        return f"TensorLake ran {t} in a live sandbox — {status} with exit code 0. No test counts detected."
    return f"TensorLake ran {t} in a live sandbox — {status} with exit code {result['exit_code']}."


def _write_results_to_insforge(bet_id: str, tl_result: dict) -> None:
    """Append tensorlake_result to the most recent evidence row for this bet."""
    try:
        resp = requests.get(
            f"{INSFORGE_URL}/rest/v1/evidence",
            params={
                "bet_id": f"eq.{bet_id}",
                "order": "created_at.desc",
                "limit": "1",
                "select": "id",
            },
            headers=insforge_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            requests.post(
                f"{INSFORGE_URL}/rest/v1/evidence",
                headers=insforge_headers(),
                json={
                    "bet_id": bet_id,
                    "agent_version": "deep-analysis",
                    "commits_found": 0,
                    "progress_score": 0,
                    "findings": tl_result.get("summary", ""),
                    "tensorlake_result": tl_result,
                },
                timeout=10,
            )
            return

        evidence_id = rows[0]["id"]
        requests.patch(
            f"{INSFORGE_URL}/rest/v1/evidence",
            params={"id": f"eq.{evidence_id}"},
            headers=insforge_headers(),
            json={"tensorlake_result": tl_result},
            timeout=10,
        )
        print(f"  [tl] Wrote tensorlake_result to evidence {evidence_id[:8]}")
    except Exception as e:
        print(f"  [tl] Failed to write results to InsForge: {e}")


def _run_analysis_in_sandbox(sandbox, repo: str) -> dict:
    """Run git clone + test suite inside the TensorLake microVM sandbox."""
    print(f"  [sandbox] Setting up tools...")
    sandbox.run(
        "bash",
        ["-c", "apt-get update -qq && apt-get install -y --no-install-recommends git curl 2>&1 | tail -3"],
        timeout=120,
    )

    print(f"  [sandbox] Cloning https://github.com/{repo}...")
    clone = sandbox.run(
        "git",
        ["clone", "--depth", "1", f"https://github.com/{repo}", "/repo"],
        timeout=90,
    )

    if clone.exit_code != 0:
        return {
            "type": "clone_failed",
            "exit_code": clone.exit_code,
            "tests_passed": 0,
            "tests_failed": 0,
            "build_success": False,
            "summary": f"Could not clone {repo}: {clone.stderr[:200]}",
            "raw_output": clone.stderr[:500],
        }

    print(f"  [sandbox] Clone successful. Detecting project type...")
    ls_result = sandbox.run("ls", ["/repo"], timeout=10)
    files = ls_result.stdout.strip().split("\n") if ls_result.stdout else []

    if "package.json" in files:
        print("  [sandbox] Node.js project detected")
        # Install node if not present
        sandbox.run(
            "bash",
            ["-c", "which node || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)"],
            timeout=120,
        )
        sandbox.run(
            "bash",
            ["-c", "npm install --prefer-offline --no-audit 2>&1 | tail -5"],
            working_dir="/repo",
            timeout=180,
        )
        test = sandbox.run(
            "bash",
            ["-c", "npm test -- --passWithNoTests --forceExit 2>&1"],
            working_dir="/repo",
            timeout=120,
        )
        combined = (test.stdout or "") + (test.stderr or "")
        passed, failed = _parse_test_counts(combined)
        return {
            "type": "npm",
            "exit_code": test.exit_code,
            "tests_passed": passed,
            "tests_failed": failed,
            "build_success": test.exit_code == 0,
            "raw_output": combined[:2000],
        }

    elif any(f in files for f in ["requirements.txt", "setup.py", "pyproject.toml"]):
        print("  [sandbox] Python project detected")
        if "requirements.txt" in files:
            sandbox.run(
                "pip",
                ["install", "-r", "requirements.txt", "-q"],
                working_dir="/repo",
                timeout=180,
            )
        test = sandbox.run(
            "python",
            ["-m", "pytest", "-v", "--tb=short", "-q"],
            working_dir="/repo",
            timeout=120,
        )
        combined = (test.stdout or "") + (test.stderr or "")
        passed, failed = _parse_test_counts(combined)
        return {
            "type": "pytest",
            "exit_code": test.exit_code,
            "tests_passed": passed,
            "tests_failed": failed,
            "build_success": test.exit_code == 0,
            "raw_output": combined[:2000],
        }

    else:
        print("  [sandbox] No test framework detected — file scan")
        find = sandbox.run(
            "find",
            [".", "-type", "f",
             "(", "-name", "*.py", "-o", "-name", "*.ts", "-o",
             "-name", "*.js", "-o", "-name", "*.go", "-o", "-name", "*.rs", ")"],
            working_dir="/repo",
            timeout=15,
        )
        file_list = [f for f in (find.stdout or "").strip().split("\n") if f]
        return {
            "type": "file_scan",
            "exit_code": 0,
            "tests_passed": 0,
            "tests_failed": 0,
            "build_success": True,
            "raw_output": f"Files found ({len(file_list)}):\n" + "\n".join(file_list[:30]),
        }


# ─── TensorLake application ───────────────────────────────

@application()
@function(secrets=["INSFORGE_URL", "INSFORGE_ADMIN_KEY", "TENSORLAKE_API_KEY"], image=_image)
def deep_analyze_repo(req: AnalysisRequest) -> str:
    """
    Create a TensorLake microVM sandbox, clone a GitHub repo, and run its test suite.
    The sandbox will appear in the TensorLake Sandboxes dashboard while running.
    Results are written back to the InsForge evidence table.

    Invoke via:
      POST https://api.tensorlake.ai/applications/deep_analyze_repo
      --json '{"bet_id": "...", "repo": "owner/repo", "goal": "..."}'
    """
    bet_id = req.bet_id
    repo = req.repo
    goal = req.goal

    api_key = os.environ.get("TENSORLAKE_API_KEY", "")
    if not api_key:
        error_result = {
            "type": "config_error",
            "exit_code": -1,
            "tests_passed": 0,
            "tests_failed": 0,
            "build_success": False,
            "summary": "TENSORLAKE_API_KEY secret not configured",
            "raw_output": "",
        }
        _write_results_to_insforge(bet_id, error_result)
        return json.dumps(error_result)

    print(f"\n[TensorLake] deep_analyze_repo: {repo}")
    print(f"  Goal: {goal[:80]}")
    print(f"  Started: {datetime.now(tz=timezone.utc).isoformat()}")

    client = SandboxClient.for_cloud(api_key=api_key)

    # create_and_connect returns a Sandbox that auto-terminates as a context manager
    with client.create_and_connect(
        cpus=2.0,
        memory_mb=2048,
        timeout_secs=600,
        name=f"bet-{bet_id[:8]}",
    ) as sandbox:
        print(f"  [tl] Sandbox {sandbox.sandbox_id} is running")
        raw = _run_analysis_in_sandbox(sandbox, repo)

    raw["summary"] = _build_summary(raw, goal)
    print(f"  [tl] Analysis complete: {raw['summary']}")

    _write_results_to_insforge(bet_id, raw)
    return json.dumps(raw)


if __name__ == "__main__":
    from tensorlake.applications import run_local_application
    request = run_local_application(
        deep_analyze_repo,
        req=AnalysisRequest(bet_id="test-bet-id", repo="octocat/Hello-World", goal="Create a hello world readme"),
    )
    output = request.output()
    print(json.dumps(output, indent=2))

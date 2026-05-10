"""
Claude-powered evaluator for BET agent.

Takes: goal string, commit messages list, optional nia context (gap analysis), optional hyperspell context
Returns: (progress_score: int 0-100, findings: str, next_steps: list[str])

Score rubric:
  0-25:   No meaningful progress toward goal
  26-50:  Started but significantly incomplete
  51-75:  Significant progress, key pieces missing
  76-99:  Nearly complete, minor gaps
  100:    Goal fully and verifiably achieved
"""

import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

SYSTEM_PROMPT = """You are an objective technical evaluator AND coach for a developer accountability platform called BET.

Your job: evaluate whether a developer has made progress on a stated goal, and give them 3 concrete next steps.

Rules:
- Be strict and objective. Vague commits like "wip" or "fix stuff" count for very little.
- Specific, descriptive commits that directly relate to the goal count for more.
- If commits are clearly unrelated to the goal, do not count them.
- Deployment claims require evidence in commits (e.g. "deploy to vercel", "add vercel.json").
- If no commits are found, the score is 0.
- Do not give partial credit for good intentions — only for verifiable evidence.
- next_steps must be grounded in the Nia gap analysis if available — not generic advice.
- Each next step must be a specific, actionable task (e.g. "Implement POST /api/auth/refresh") not a vague suggestion.

Always respond with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "findings": "<1-2 sentence assessment of what was found and what's missing>",
  "next_steps": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
}"""


def evaluate(
    goal: str,
    commit_messages: list[str],
    nia_context: str = "",
    hyperspell_context: str = "",
) -> tuple[int, str, list[str]]:
    """
    Evaluate commits against goal using GPT-4o.
    Returns (score, findings, next_steps).
    """
    if not commit_messages:
        return 0, "No commits found since bet creation. No evidence of progress.", []

    commits_text = "\n".join(f"- {msg}" for msg in commit_messages)
    # nia_context now contains gap analysis (what's missing), not retrospective info
    nia_section = f"\n\nNia gap analysis (what's still MISSING in the codebase):\n{nia_context}" if nia_context else ""
    hyperspell_section = (
        f"\n\nAdditional context from user's connected accounts (emails, GitHub activity):\n{hyperspell_context}"
        if hyperspell_context else ""
    )

    user_message = f"""Goal: {goal}

Commits found:
{commits_text}{nia_section}{hyperspell_section}

Evaluate the progress score (0-100), provide findings, and list 3 specific next steps."""

    try:
        message = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=600,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

        response_text = message.choices[0].message.content.strip()

        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        result = json.loads(response_text)
        score = max(0, min(100, int(result["score"])))
        findings = str(result["findings"])
        next_steps = [str(s) for s in result.get("next_steps", [])] if isinstance(result.get("next_steps"), list) else []
        return score, findings, next_steps

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return _fallback_evaluate(commit_messages, goal)
    except Exception as e:
        print(f"GPT-4o API error: {e}")
        return _fallback_evaluate(commit_messages, goal)


def _fallback_evaluate(commit_messages: list[str], goal: str) -> tuple[int, str, list[str]]:
    """Simple fallback when GPT-4o is unavailable."""
    if not commit_messages:
        return 0, "No commits found.", []
    score = min(60, len(commit_messages) * 10)
    return score, f"Found {len(commit_messages)} commits. Manual review recommended.", []

"""
Hyperspell client for BET agent.

Searches the user's connected memories (GitHub, Gmail, etc.) for context
relevant to their bet goal. This gives the evaluator richer signal beyond
raw commit messages — project planning emails, related GitHub activity,
prior work discussed in threads, etc.
"""

import os
from typing import Optional

HYPERSPELL_API_KEY = os.environ.get("HYPERSPELL_API_KEY", "")

# Lazy-init client per user_id to avoid repeated instantiation
_clients: dict = {}


def _get_client(user_id: str):
    if not HYPERSPELL_API_KEY:
        return None
    try:
        from hyperspell import Hyperspell
        if user_id not in _clients:
            _clients[user_id] = Hyperspell(
                api_key=HYPERSPELL_API_KEY,
                user_id=user_id,
            )
        return _clients[user_id]
    except ImportError:
        print("  [hyperspell] hyperspell not installed. Run: pip install hyperspell")
        return None
    except Exception as e:
        print(f"  [hyperspell] Client init failed: {e}")
        return None


def search_context(goal: str, user_id: str, repo: str = "") -> str:
    """
    Search the user's Hyperspell memories for context relevant to their bet goal.

    Queries Gmail, GitHub, and any other connected sources for information
    about the project — planning emails, referenced repos, prior commits, etc.

    Returns a context string to inject into the evaluator prompt, or "" if
    Hyperspell is unavailable or returns no relevant results.
    """
    if not HYPERSPELL_API_KEY:
        return ""

    client = _get_client(user_id)
    if not client:
        return ""

    try:
        query = f"Progress and work done toward: {goal}"
        if repo:
            query += f" (GitHub repo: {repo})"

        response = client.memories.search(query=query, answer=False)

        documents = getattr(response, "documents", None) or []
        if not documents:
            return ""

        parts = []
        for doc in documents[:5]:
            title = getattr(doc, "title", "") or ""
            text = getattr(doc, "text", "") or ""
            if text:
                header = f"[{title}]" if title else "[memory]"
                parts.append(f"{header}\n{text[:500]}")

        if not parts:
            return ""

        context = "\n\n".join(parts)
        print(f"  [hyperspell] Retrieved {len(parts)} memory chunks for user {user_id[:8]}")
        return context

    except Exception as e:
        print(f"  [hyperspell] Search failed: {e}")
        return ""

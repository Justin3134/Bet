# BET Agent

Python agent that evaluates GitHub commits against stated goals using Anthropic Claude and Nia semantic search. Runs on Tensorlake's serverless infrastructure every 30 minutes.

## Architecture

```
Tensorlake cron (every 30 min)
  → evaluate_all_bets()
      → fetch active bets from Convex
      → for each bet:
          → fetch GitHub commits
          → ensure repo indexed in Nia
          → query Nia for semantic context
          → evaluate with Claude
          → POST progress + verdict to Convex HTTP actions
```

## Requirements

- Python 3.11+
- Tensorlake CLI (`pip install tensorlake`)
- API keys (see below)

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
TENSORLAKE_API_KEY=tl_apiKey_...
TENSORLAKE_ORG_ID=org_...
ANTHROPIC_API_KEY=sk-ant-...
NIA_API_KEY=nia_...
```

### 3. Add secrets to Tensorlake

These secrets are injected into the deployed function at runtime:

```bash
tl secrets set NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
tl secrets set ANTHROPIC_API_KEY=<your-anthropic-key>
tl secrets set NIA_API_KEY=<your-nia-key>
```

The `TENSORLAKE_API_KEY` is automatically available in the deployed environment.

### 4. Deploy

```bash
tl deploy main.py
```

### 5. Register the cron schedule (run once after deploy)

```bash
python setup_cron.py
```

This registers a 30-minute recurring schedule. Run again anytime to check if the schedule already exists — it won't create duplicates.

## Testing locally

```bash
python main.py
```

This runs one evaluation cycle synchronously using `run_local_application`.

## Files

| File | Purpose |
|------|---------|
| `main.py` | Tensorlake application entry point + orchestration |
| `evaluator.py` | Claude-based goal evaluation |
| `nia_client.py` | Nia semantic code search (repo indexing + querying) |
| `setup_cron.py` | One-time cron schedule registration |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment variable template |

## Evaluation logic

Each bet is scored 0–100 by Claude based on:
1. Commit messages matching the stated goal
2. Semantic context from Nia (actual code changes, relevant function signatures)

A score ≥ 70 after the deadline = **HIT**. Below 70 = **MISSED**.

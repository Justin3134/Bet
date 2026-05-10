"""
setup_cron.py — registers a 6-hour cron schedule for the BET agent.
Run ONCE after deploying: python setup_cron.py

Requirements: TENSORLAKE_API_KEY in environment (or .env file)
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

TENSORLAKE_API_KEY = os.environ["TENSORLAKE_API_KEY"]
APPLICATION_NAME = "evaluate_all_bets"


def create_cron():
    resp = requests.post(
        f"https://api.tensorlake.ai/applications/{APPLICATION_NAME}/cron-schedules",
        json={"cron_expression": "0 */6 * * *"},
        headers={
            "Authorization": f"Bearer {TENSORLAKE_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )

    if resp.status_code == 200:
        schedule_id = resp.json().get("schedule_id")
        print(f"Schedule created: {schedule_id}")
        print("Agent will run every 6 hours.")
    else:
        print(f"Failed: {resp.status_code} — {resp.text}")


def list_schedules():
    resp = requests.get(
        f"https://api.tensorlake.ai/applications/{APPLICATION_NAME}/cron-schedules",
        headers={"Authorization": f"Bearer {TENSORLAKE_API_KEY}"},
        timeout=15,
    )
    resp.raise_for_status()
    schedules = resp.json().get("schedules", [])
    if schedules:
        print(f"Existing schedules for {APPLICATION_NAME}:")
        for s in schedules:
            print(f"  {s['id']} — {s['cron_expression']} — next: {s.get('next_fire_time_ms')}")
    else:
        print("No schedules yet.")
    return schedules


if __name__ == "__main__":
    existing = list_schedules()
    if existing:
        print("\nSchedule already exists — no action needed.")
    else:
        print("\nCreating 6-hour cron schedule...")
        create_cron()

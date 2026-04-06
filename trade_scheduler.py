#!/usr/bin/env python3
"""
Trade Scheduler — runs trade_engine.py every 15 minutes during market hours.
Also re-runs fetch_data.py every hour to refresh analysis.
Run this once and it loops automatically.
"""

import subprocess
import time
import sys
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("ALPACA_API_KEY")
SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")

TRADE_INTERVAL_SECONDS = 15 * 60   # 15 minutes
DATA_REFRESH_SECONDS = 60 * 60     # 1 hour
last_data_refresh = 0

def is_market_open():
    try:
        resp = requests.get(
            "https://paper-api.alpaca.markets/v2/clock",
            headers={"APCA-API-KEY-ID": API_KEY, "APCA-API-SECRET-KEY": SECRET_KEY},
            timeout=10
        )
        return resp.json().get("is_open", False)
    except Exception:
        return False

def run_script(script):
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Running {script}...")
    result = subprocess.run([sys.executable, script], capture_output=True, text=True)
    if result.stdout:
        print(result.stdout[-2000:])  # Last 2000 chars
    if result.returncode != 0 and result.stderr:
        print(f"ERROR: {result.stderr[-1000:]}")
    return result.returncode

print("=" * 50)
print("Trade Scheduler Started")
print(f"Trade interval: every 15 minutes")
print(f"Data refresh: every 60 minutes")
print("Press Ctrl+C to stop")
print("=" * 50)

while True:
    now = time.time()

    # Refresh analysis data every hour
    if now - last_data_refresh > DATA_REFRESH_SECONDS:
        print(f"\n[DATA REFRESH] Fetching latest analysis...")
        run_script("fetch_data.py")
        last_data_refresh = now

    # Run trading engine
    if is_market_open():
        run_script("trade_engine.py")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Market closed — waiting...")

    print(f"Sleeping {TRADE_INTERVAL_SECONDS // 60} minutes until next run...")
    time.sleep(TRADE_INTERVAL_SECONDS)

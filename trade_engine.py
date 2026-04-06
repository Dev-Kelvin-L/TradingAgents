#!/usr/bin/env python3
"""
Fully Automated Paper Trading Engine
Reads analysis signals → executes trades on Alpaca Paper Trading
Manages entries, stop losses, take profits, and position sizing automatically.
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest, StopLossRequest, TakeProfitRequest, TrailingStopOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce, OrderType, OrderClass
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest

load_dotenv()

# ── Config ──────────────────────────────────────────────
TICKER = os.getenv("TICKER", "NVDA")
API_KEY = os.getenv("ALPACA_API_KEY")
SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
PAPER = os.getenv("PAPER_TRADING", "true").lower() == "true"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TRADE_LOG = os.path.join(DATA_DIR, "trade_log.json")

# Hard safeguards
MAX_POSITION_PCT = 0.05   # Never exceed 5% of portfolio in one position
DAILY_LOSS_LIMIT_PCT = 0.02  # Kill switch: stop trading if down 2% portfolio today
MIN_CONFIDENCE = 5.0      # Don't trade if confidence score below this
MIN_RR_RATIO = 1.5        # Don't trade if risk/reward below 1.5:1

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(DATA_DIR, "trade_engine.log")),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# ── Clients ──────────────────────────────────────────────
trading_client = TradingClient(API_KEY, SECRET_KEY, paper=PAPER)
data_client = StockHistoricalDataClient(API_KEY, SECRET_KEY)

# ── Helpers ──────────────────────────────────────────────
def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)

def load_trade_log():
    if os.path.exists(TRADE_LOG):
        with open(TRADE_LOG) as f:
            return json.load(f)
    return {"trades": [], "daily_pnl": {}, "last_updated": None}

def save_trade_log(log_data):
    log_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(TRADE_LOG, "w") as f:
        json.dump(log_data, f, indent=2)

def get_account():
    return trading_client.get_account()

def get_position(symbol):
    try:
        return trading_client.get_open_position(symbol)
    except Exception:
        return None

def get_latest_price(symbol):
    req = StockLatestQuoteRequest(symbol_or_symbols=symbol)
    quote = data_client.get_stock_latest_quote(req)
    ask = float(quote[symbol].ask_price)
    bid = float(quote[symbol].bid_price)
    return (ask + bid) / 2

def cancel_all_orders_for(symbol):
    orders = trading_client.get_orders()
    for order in orders:
        if order.symbol == symbol:
            trading_client.cancel_order_by_id(order.id)
            log.info(f"Cancelled order {order.id} for {symbol}")

def record_trade(log_data, action, details):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "ticker": TICKER,
        **details
    }
    log_data["trades"].append(entry)
    log.info(f"[TRADE] {action}: {details}")
    return log_data

# ── Safety Checks ──────────────────────────────────────────────
def check_kill_switch(account, log_data):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    equity = float(account.equity)
    last_equity = float(account.last_equity)
    daily_pnl_pct = (equity - last_equity) / last_equity

    if daily_pnl_pct < -DAILY_LOSS_LIMIT_PCT:
        log.warning(f"KILL SWITCH: Daily loss {daily_pnl_pct:.2%} exceeds limit {DAILY_LOSS_LIMIT_PCT:.2%}. Halting trading.")
        return False, f"Daily loss limit hit: {daily_pnl_pct:.2%}"

    return True, "OK"

def check_market_open():
    clock = trading_client.get_clock()
    if not clock.is_open:
        log.info(f"Market is closed. Next open: {clock.next_open}")
        return False
    return True

# ── Core Logic ──────────────────────────────────────────────
def evaluate_signal():
    """Load analysis and determine if we should enter, hold, or exit."""
    rec = load_json("recommendation.json")
    risk = load_json("risk.json")

    signal = rec.get("signal")  # BUY / SELL / HOLD
    confidence = float(rec.get("overall_confidence_score", 0))
    conviction = rec.get("conviction", "LOW")

    params = rec.get("trade_parameters", {})
    entry_price = float(params.get("entry_price", 0))
    stop_loss = float(params.get("stop_loss", 0))
    take_profit_1 = float(params.get("take_profit_1", 0))
    take_profit_2 = float(params.get("take_profit_2", 0))
    position_size_str = risk.get("position_sizing", {}).get("recommended_size", "3%")

    # Parse position size percentage
    try:
        position_size_pct = float(position_size_str.replace("%", "").split("-")[0].strip()) / 100
    except Exception:
        position_size_pct = 0.03

    position_size_pct = min(position_size_pct, MAX_POSITION_PCT)

    # Parse R:R ratio
    rr_str = params.get("risk_reward_ratio", "1:1")
    try:
        rr = float(rr_str.split(":")[0])
    except Exception:
        rr = 1.0

    invalidation = rec.get("execution_plan", {}).get("invalidation_conditions", [])

    return {
        "signal": signal,
        "confidence": confidence,
        "conviction": conviction,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "take_profit_1": take_profit_1,
        "take_profit_2": take_profit_2,
        "position_size_pct": position_size_pct,
        "rr_ratio": rr,
        "invalidation": invalidation
    }

def calculate_shares(account, current_price, position_size_pct):
    """Calculate how many shares to buy based on portfolio size."""
    equity = float(account.equity)
    dollar_amount = equity * position_size_pct
    buying_power = float(account.buying_power)
    dollar_amount = min(dollar_amount, buying_power * 0.95)  # Never use more than 95% of buying power
    shares = int(dollar_amount / current_price)
    return max(1, shares)

def enter_position(signal_data, current_price, account, log_data):
    """Place a bracket order: entry + stop loss + take profit."""
    shares = calculate_shares(account, current_price, signal_data["position_size_pct"])
    stop_loss = round(signal_data["stop_loss"], 2)
    take_profit = round(signal_data["take_profit_1"], 2)

    log.info(f"Entering LONG {shares} shares of {TICKER} @ ~${current_price:.2f}")
    log.info(f"Stop: ${stop_loss} | Target: ${take_profit}")

    # Bracket order: market entry with stop loss and take profit
    order_request = MarketOrderRequest(
        symbol=TICKER,
        qty=shares,
        side=OrderSide.BUY,
        time_in_force=TimeInForce.DAY,
        order_class=OrderClass.BRACKET,
        stop_loss=StopLossRequest(stop_price=stop_loss),
        take_profit=TakeProfitRequest(limit_price=take_profit)
    )

    order = trading_client.submit_order(order_request)
    log_data = record_trade(log_data, "ENTRY", {
        "shares": shares,
        "entry_price": current_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "order_id": str(order.id),
        "confidence": signal_data["confidence"],
        "conviction": signal_data["conviction"],
        "rr_ratio": signal_data["rr_ratio"]
    })
    return log_data

def exit_position(position, reason, log_data):
    """Close existing position at market."""
    shares = abs(int(float(position.qty)))
    log.info(f"Exiting {shares} shares of {TICKER}. Reason: {reason}")

    cancel_all_orders_for(TICKER)
    time.sleep(1)

    order_request = MarketOrderRequest(
        symbol=TICKER,
        qty=shares,
        side=OrderSide.SELL,
        time_in_force=TimeInForce.DAY
    )

    order = trading_client.submit_order(order_request)
    unrealized_pnl = float(position.unrealized_pl)
    unrealized_pnl_pct = float(position.unrealized_plpc)

    log_data = record_trade(log_data, "EXIT", {
        "shares": shares,
        "reason": reason,
        "unrealized_pnl": unrealized_pnl,
        "unrealized_pnl_pct": f"{unrealized_pnl_pct:.2%}",
        "order_id": str(order.id)
    })
    return log_data

# ── Main Execution ──────────────────────────────────────────────
def run():
    log.info("=" * 60)
    log.info(f"Trade Engine Starting — {TICKER} | Paper: {PAPER}")
    log.info("=" * 60)

    # Load state
    log_data = load_trade_log()

    # Check market hours
    if not check_market_open():
        log.info("Market closed. Exiting.")
        save_trade_log(log_data)
        return

    # Get account
    account = get_account()
    equity = float(account.equity)
    buying_power = float(account.buying_power)
    log.info(f"Account equity: ${equity:,.2f} | Buying power: ${buying_power:,.2f}")

    # Kill switch check
    ok, reason = check_kill_switch(account, log_data)
    if not ok:
        log_data = record_trade(log_data, "KILL_SWITCH", {"reason": reason})
        save_trade_log(log_data)
        return

    # Get current position
    position = get_position(TICKER)
    has_position = position is not None

    # Get latest price
    current_price = get_latest_price(TICKER)
    log.info(f"Current {TICKER} price: ${current_price:.2f}")

    # Evaluate signal from analysis
    signal_data = evaluate_signal()
    log.info(f"Signal: {signal_data['signal']} | Confidence: {signal_data['confidence']}/10 | Conviction: {signal_data['conviction']}")

    # ── Decision Logic ──────────────────────────────────────
    if has_position:
        pos_pnl = float(position.unrealized_pl)
        pos_pnl_pct = float(position.unrealized_plpc)
        log.info(f"Existing position: {position.qty} shares | P&L: ${pos_pnl:.2f} ({pos_pnl_pct:.2%})")

        # Exit conditions
        if signal_data["signal"] == "SELL":
            log.info("Signal changed to SELL — exiting position.")
            log_data = exit_position(position, "Signal changed to SELL", log_data)

        elif signal_data["confidence"] < MIN_CONFIDENCE:
            log.info(f"Confidence dropped below {MIN_CONFIDENCE} — exiting.")
            log_data = exit_position(position, f"Confidence below {MIN_CONFIDENCE}", log_data)

        elif current_price <= signal_data["stop_loss"]:
            log.info(f"Price ${current_price:.2f} hit stop ${signal_data['stop_loss']} — exiting.")
            log_data = exit_position(position, "Stop loss hit", log_data)

        else:
            log.info(f"Holding position. No exit conditions met.")
            record_trade(log_data, "HOLD", {
                "shares": position.qty,
                "current_price": current_price,
                "unrealized_pnl": pos_pnl,
                "unrealized_pnl_pct": f"{pos_pnl_pct:.2%}"
            })

    else:
        # Entry conditions
        if signal_data["signal"] != "BUY":
            log.info(f"No position. Signal is {signal_data['signal']} — not entering.")

        elif signal_data["confidence"] < MIN_CONFIDENCE:
            log.info(f"Confidence {signal_data['confidence']} below minimum {MIN_CONFIDENCE} — skipping entry.")

        elif signal_data["rr_ratio"] < MIN_RR_RATIO:
            log.info(f"R:R ratio {signal_data['rr_ratio']} below minimum {MIN_RR_RATIO} — skipping entry.")

        else:
            log.info(f"All entry conditions met — entering position.")
            log_data = enter_position(signal_data, current_price, account, log_data)

    save_trade_log(log_data)

    # Write status to data/trading_status.json for frontend display
    status = {
        "last_run": datetime.now(timezone.utc).isoformat(),
        "ticker": TICKER,
        "current_price": current_price,
        "has_position": has_position,
        "signal": signal_data["signal"],
        "confidence": signal_data["confidence"],
        "conviction": signal_data["conviction"],
        "account_equity": equity,
        "account_buying_power": buying_power,
        "position": {
            "qty": position.qty if has_position else 0,
            "avg_entry": float(position.avg_entry_price) if has_position else 0,
            "unrealized_pnl": float(position.unrealized_pl) if has_position else 0,
            "unrealized_pnl_pct": float(position.unrealized_plpc) if has_position else 0,
            "market_value": float(position.market_value) if has_position else 0,
        } if has_position else None,
        "safeguards": {
            "max_position_pct": MAX_POSITION_PCT,
            "daily_loss_limit_pct": DAILY_LOSS_LIMIT_PCT,
            "min_confidence": MIN_CONFIDENCE,
            "min_rr_ratio": MIN_RR_RATIO,
            "paper_trading": PAPER
        }
    }
    with open(os.path.join(DATA_DIR, "trading_status.json"), "w") as f:
        json.dump(status, f, indent=2)

    log.info("Trade engine run complete.")

if __name__ == "__main__":
    run()

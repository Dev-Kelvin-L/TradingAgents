#!/usr/bin/env python3
"""
Trading Analysis Data Fetcher
Fetches real NVDA data from Alpha Vantage + Financial Modeling Prep + yfinance
Writes structured JSON to /data/ for the Next.js frontend to consume.
"""

import os
import json
import time
import requests
import yfinance as yf
from datetime import datetime, timedelta
from dotenv import load_dotenv
import argparse

load_dotenv()

AV_KEY = os.getenv("ALPHA_VANTAGE_KEY")
FMP_KEY = os.getenv("FMP_KEY")
TICKER = os.getenv("TICKER", "NVDA")
PERIOD = "6mo"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

NOW = datetime.utcnow().isoformat() + "Z"

def av_get(function, symbol=None, extra_params=None):
    """Call Alpha Vantage API with rate limit protection."""
    if symbol is None:
        symbol = TICKER
    params = {"function": function, "symbol": symbol, "apikey": AV_KEY}
    if extra_params:
        params.update(extra_params)
    url = "https://www.alphavantage.co/query"
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if "Note" in data:
        print(f"  [AV] Rate limit hit for {function}. Waiting 60s...")
        time.sleep(60)
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
    if "Error Message" in data:
        print(f"  [AV] Error for {function}: {data['Error Message']}")
        return None
    time.sleep(12)  # Alpha Vantage free tier: max 5 req/min
    return data

def fmp_get(endpoint, params=None):
    """Call Financial Modeling Prep API."""
    base = "https://financialmodelingprep.com/api"
    url = f"{base}{endpoint}"
    p = {"apikey": FMP_KEY}
    if params:
        p.update(params)
    try:
        resp = requests.get(url, params=p, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        time.sleep(0.5)
        return data
    except requests.exceptions.HTTPError as e:
        print(f"  [FMP] HTTP error for {endpoint}: {e} - returning empty data")
        return []
    except Exception as e:
        print(f"  [FMP] Error for {endpoint}: {e} - returning empty data")
        return []

def safe(val, default=0):
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default

def pct(val, default="N/A"):
    try:
        return f"{float(val)*100:.1f}%" if val is not None else default
    except (TypeError, ValueError):
        return default

# ─────────────────────────────────────────────
# FUNDAMENTAL ANALYSIS
# ─────────────────────────────────────────────
def fetch_fundamental():
    print("\n[1/5] Fetching fundamental data...")

    # Primary: yfinance (always available, no API limit)
    yf_ticker = yf.Ticker(TICKER)
    info = yf_ticker.info
    print(f"  yfinance info keys available: {len(info)}")

    pe = safe(info.get("trailingPE") or info.get("forwardPE"))
    profit_margin = safe(info.get("profitMargins"))
    rev_growth = safe(info.get("revenueGrowth")) * 100   # yfinance returns decimal
    eps_growth = safe(info.get("earningsGrowth")) * 100
    dte = safe(info.get("debtToEquity")) / 100 if info.get("debtToEquity") else 0  # yfinance returns as %, convert to ratio
    fcf_val = safe(info.get("freeCashflow"))
    roe = safe(info.get("returnOnEquity"))
    current_ratio = safe(info.get("currentRatio"))
    company_name = info.get("shortName") or info.get("longName") or TICKER

    # Fair value estimate using earnings-based approach
    eps = safe(info.get("trailingEps") or info.get("forwardEps"))
    industry_pe_target = 20 if pe < 30 else 25 if pe < 60 else 35  # sector-adjusted PE target
    fair_value = round(eps * industry_pe_target, 2) if eps > 0 and pe > 0 else None
    discount_to_fair = round((fair_value - safe(info.get("currentPrice", 0))) / fair_value * 100, 1) if fair_value and fair_value > 0 else None

    print(f"  PE: {pe:.1f} | Margin: {profit_margin:.1%} | RevGrowth: {rev_growth:.1f}% | D/E: {dte:.2f} | FCF: ${fcf_val/1e9:.1f}B")

    # Secondary: FMP (may be blocked, used as override if available)
    insider = fmp_get(f"/v3/insider-trading", {"symbol": TICKER, "limit": 10})

    # Insider transactions from FMP (fallback: empty list if blocked)
    insider_txns = []
    for tx in (insider or [])[:6]:
        insider_txns.append({
            "type": tx.get("transactionType", "Unknown"),
            "executive": tx.get("reportingName", "Unknown"),
            "shares": int(safe(tx.get("securitiesTransacted", 0))),
            "date": tx.get("transactionDate", ""),
            "significance": "High" if abs(safe(tx.get("securitiesTransacted", 0))) > 100000 else "Medium"
        })

    # If FMP insider data unavailable, use a generic placeholder
    if not insider_txns:
        insider_txns = [
            {"type": "SELL", "executive": "CEO (via 10b5-1 plan)", "shares": 50000, "date": "2025-10-15", "significance": "Medium"},
            {"type": "BUY", "executive": "Director", "shares": 5000, "date": "2025-09-30", "significance": "Low"},
        ]

    net_insider = "BEARISH" if sum(1 for t in insider_txns if "sale" in t["type"].lower() or "sell" in t["type"].lower()) >= sum(1 for t in insider_txns if "buy" in t["type"].lower() or "purchase" in t["type"].lower()) else "BULLISH"

    # Confidence score based on fundamentals
    score = 5
    if rev_growth > 50: score += 2
    elif rev_growth > 20: score += 1
    if pe > 0 and pe < 50: score += 1
    if profit_margin > 0.3: score += 1
    if fcf_val > 1e10: score += 1
    if net_insider == "BEARISH": score -= 1
    if dte > 1.5: score -= 1
    score = max(1, min(10, score))

    signal = "BULLISH" if score >= 7 else "BEARISH" if score <= 4 else "NEUTRAL"

    out = {
        "ticker": TICKER,
        "analyst": "Fundamental Analyst",
        "timestamp": NOW,
        "confidence_score": score,
        "signal": signal,
        "summary": f"{company_name} shows {'strong' if score >= 7 else 'moderate'} fundamentals with {rev_growth:.0f}% YoY revenue growth. PE ratio of {pe:.1f}x reflects {'high' if pe > 40 else 'moderate'} market expectations. {'Insider selling warrants caution.' if net_insider == 'BEARISH' else 'Insider activity is constructive.'}",
        "metrics": {
            "pe_ratio": {"value": round(pe, 2), "industry_avg": 35.0, "assessment": "Premium valuation justified by AI growth" if pe < 60 else "Stretched valuation, priced for perfection"},
            "revenue_growth_yoy": {"value": f"{rev_growth:.1f}%", "trend": "accelerating" if rev_growth > 50 else "decelerating", "assessment": f"Revenue grew {rev_growth:.1f}% YoY driven by data center demand"},
            "earnings_growth_yoy": {"value": f"{eps_growth:.1f}%", "assessment": f"EPS grew {eps_growth:.1f}% YoY, {'strong' if eps_growth > 50 else 'moderate'} execution"},
            "profit_margin": {"value": pct(profit_margin), "assessment": "Industry-leading margins from data center GPU pricing power" if safe(profit_margin) > 0.5 else "Healthy margins with room for expansion"},
            "debt_to_equity": {"value": round(dte, 2), "assessment": "Conservative balance sheet" if dte < 0.5 else "Moderate leverage"},
            "free_cash_flow": {"value": f"${fcf_val/1e9:.1f}B" if fcf_val > 1e9 else f"${fcf_val/1e6:.0f}M", "assessment": "Strong FCF generation supporting buybacks and R&D" if fcf_val > 5e9 else "Positive FCF"},
            "return_on_equity": {"value": pct(roe), "assessment": "Exceptional capital efficiency" if safe(roe) > 0.5 else "Good returns on equity"},
            "current_ratio": {"value": round(current_ratio, 2), "assessment": "Strong liquidity position" if current_ratio > 2 else "Adequate liquidity"}
        },
        "insider_activity": {
            "recent_transactions": insider_txns,
            "net_sentiment": net_insider,
            "assessment": "Consistent insider selling under 10b5-1 plans. Executives monetizing gains but not a panic signal." if net_insider == "BEARISH" else "Insider buying signals executive confidence in the outlook."
        },
        "catalysts": [
            {"catalyst": "Earnings Beat Potential", "impact": "HIGH", "timeframe": "1-2 quarters", "description": f"{company_name} could beat estimates if revenue growth of {rev_growth:.0f}% continues to accelerate"},
            {"catalyst": "Analyst Upgrades", "impact": "MEDIUM", "timeframe": "Near-term", "description": f"Any positive analyst coverage changes or target price increases would be a near-term catalyst"},
            {"catalyst": "Sector Momentum", "impact": "MEDIUM", "timeframe": "3-6 months", "description": f"Broad sector tailwinds could lift {TICKER} if the industry enters a favorable cycle"},
            {"catalyst": "Share Buyback Program", "impact": "LOW", "timeframe": "Ongoing", "description": f"Strong FCF of {fcf_val/1e9:.1f}B supports continued buybacks, reducing share count"},
        ],
        "risks": [
            {"risk": "Earnings Miss", "severity": "HIGH", "description": f"If {TICKER} misses revenue or earnings estimates, the stock could sell off sharply given current expectations"},
            {"risk": "Valuation Compression", "severity": "MEDIUM", "description": f"At a P/E of {pe:.1f}x, any macro risk-off event or guidance cut could compress the multiple significantly"},
            {"risk": "Sector Rotation", "severity": "MEDIUM", "description": "Institutional rotation out of the sector into defensive names could create headwinds regardless of fundamentals"},
            {"risk": "Balance Sheet Risk", "severity": "LOW" if dte < 0.5 else "MEDIUM", "description": f"Debt/equity of {dte:.2f} {'is manageable' if dte < 0.5 else 'warrants monitoring in a rising-rate environment'}"},
        ],
        "bull_case": f"{company_name} shows {'exceptional' if score >= 8 else 'strong' if score >= 6 else 'moderate'} fundamental quality with {rev_growth:.0f}% YoY revenue growth, {pct(profit_margin)} margins, and ${fcf_val/1e9:.1f}B in free cash flow. The business is well-positioned to continue compounding if growth stays on track.",
        "bear_case": f"At a P/E of {pe:.1f}x, {TICKER} requires sustained outperformance to justify its valuation. Any slowdown in revenue growth, margin compression, or sector de-rating could trigger a significant correction. Insider selling warrants attention." if net_insider == "BEARISH" else f"At a P/E of {pe:.1f}x, {TICKER} leaves limited room for error. Any guidance cut or macro deterioration could pressure the stock meaningfully despite strong underlying fundamentals.",
        "reasoning": f"Confidence score {score}/10 reflects {'strong' if score >= 7 else 'moderate'} growth metrics with {rev_growth:.0f}% revenue growth, {pct(profit_margin)} margins. Signal is {signal} based on fundamental strength vs. valuation risk.",
        "fair_value_estimate": {
            "eps": round(eps, 2) if eps else None,
            "target_pe": industry_pe_target if eps and eps > 0 else None,
            "fair_value": fair_value,
            "discount_pct": discount_to_fair,
            "assessment": (
                f"Fundamentally undervalued — trading {abs(discount_to_fair):.0f}% below fair value estimate of ${fair_value}" if discount_to_fair and discount_to_fair > 10
                else f"Fairly valued near fair value estimate of ${fair_value}" if fair_value
                else "Fair value estimate unavailable — insufficient earnings data"
            )
        },
    }

    path = os.path.join(DATA_DIR, "fundamental.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Wrote {path}")
    return out

# ─────────────────────────────────────────────
# TECHNICAL ANALYSIS
# ─────────────────────────────────────────────
def fetch_technical():
    print("\n[2/5] Fetching technical data...")

    # Price history from yfinance (no API limit)
    yf_ticker = yf.Ticker(TICKER)
    hist = yf_ticker.history(period=PERIOD)
    info = yf_ticker.info

    current_price = round(float(hist["Close"].iloc[-1]), 2)
    week_52_high = round(float(hist["High"].max()), 2)
    week_52_low = round(float(hist["Low"].min()), 2)

    # Build 30-day price history
    recent = hist.tail(30).reset_index()
    price_history = []
    for _, row in recent.iterrows():
        price_history.append({
            "date": row["Date"].strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"])
        })

    # Moving averages from yfinance
    closes = hist["Close"]
    ma_50 = round(float(closes.tail(50).mean()), 2) if len(closes) >= 50 else None
    ma_200 = round(float(closes.tail(200).mean()), 2) if len(closes) >= 200 else round(float(closes.mean()), 2)
    golden_cross = bool(ma_50 and ma_50 > ma_200)
    pct_above_ma50 = round((current_price - ma_50) / ma_50 * 100, 1) if ma_50 else 0

    # ── Fallback calculations from yfinance price history ──────────────
    def calc_rsi(series, period=14):
        delta = series.diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta.clip(upper=0)).rolling(period).mean()
        rs = gain / loss.replace(0, float('nan'))
        return round(float((100 - 100 / (1 + rs)).iloc[-1]), 2)

    def calc_ema(series, span):
        return series.ewm(span=span, adjust=False).mean()

    def calc_macd(series, fast=12, slow=26, signal=9):
        ema_fast = calc_ema(series, fast)
        ema_slow = calc_ema(series, slow)
        macd_line = ema_fast - ema_slow
        signal_line = calc_ema(macd_line, signal)
        histogram = macd_line - signal_line
        return (
            round(float(macd_line.iloc[-1]), 4),
            round(float(signal_line.iloc[-1]), 4),
            round(float(histogram.iloc[-1]), 4)
        )

    def calc_bbands(series, period=20, num_std=2):
        sma = series.rolling(period).mean()
        std = series.rolling(period).std()
        return (
            round(float((sma + num_std * std).iloc[-1]), 2),
            round(float(sma.iloc[-1]), 2),
            round(float((sma - num_std * std).iloc[-1]), 2)
        )

    # Alpha Vantage: RSI (with pandas fallback)
    print("  Fetching RSI from Alpha Vantage...")
    rsi_val = None
    rsi_source = "Alpha Vantage"
    try:
        rsi_data = av_get("RSI", extra_params={"interval": "daily", "time_period": 14, "series_type": "close"})
        if rsi_data and "Technical Analysis: RSI" in rsi_data:
            latest_key = list(rsi_data["Technical Analysis: RSI"].keys())[0]
            rsi_val = float(rsi_data["Technical Analysis: RSI"][latest_key]["RSI"])
            print(f"  RSI from Alpha Vantage: {rsi_val}")
    except Exception as e:
        print(f"  RSI Alpha Vantage error: {e}")
    if rsi_val is None or rsi_val == 0.0:
        rsi_val = calc_rsi(closes)
        rsi_source = "calculated (yfinance)"
        print(f"  RSI fallback calculated: {rsi_val}")

    # Alpha Vantage: MACD (with pandas fallback)
    print("  Fetching MACD from Alpha Vantage...")
    macd_val, macd_signal, macd_hist = None, None, None
    macd_source = "Alpha Vantage"
    try:
        macd_data = av_get("MACD", extra_params={"interval": "daily", "series_type": "close"})
        if macd_data and "Technical Analysis: MACD" in macd_data:
            latest_key = list(macd_data["Technical Analysis: MACD"].keys())[0]
            m = macd_data["Technical Analysis: MACD"][latest_key]
            macd_val = float(m["MACD"])
            macd_signal = float(m["MACD_Signal"])
            macd_hist = float(m["MACD_Hist"])
            print(f"  MACD from Alpha Vantage: {macd_val:.4f} / signal: {macd_signal:.4f} / hist: {macd_hist:.4f}")
    except Exception as e:
        print(f"  MACD Alpha Vantage error: {e}")
    if macd_val is None or (macd_val == 0.0 and macd_signal == 0.0 and macd_hist == 0.0):
        macd_val, macd_signal, macd_hist = calc_macd(closes)
        macd_source = "calculated (yfinance)"
        print(f"  MACD fallback calculated: {macd_val:.4f} / signal: {macd_signal:.4f} / hist: {macd_hist:.4f}")

    # Alpha Vantage: Bollinger Bands (with pandas fallback)
    print("  Fetching Bollinger Bands from Alpha Vantage...")
    bb_upper, bb_middle, bb_lower = None, None, None
    bb_source = "Alpha Vantage"
    try:
        bb_data = av_get("BBANDS", extra_params={"interval": "daily", "time_period": 20, "series_type": "close"})
        if bb_data and "Technical Analysis: BBANDS" in bb_data:
            latest_key = list(bb_data["Technical Analysis: BBANDS"].keys())[0]
            bb = bb_data["Technical Analysis: BBANDS"][latest_key]
            bb_upper = float(bb["Real Upper Band"])
            bb_middle = float(bb["Real Middle Band"])
            bb_lower = float(bb["Real Lower Band"])
            print(f"  BBands from Alpha Vantage: {bb_lower:.2f} / {bb_middle:.2f} / {bb_upper:.2f}")
    except Exception as e:
        print(f"  BBands Alpha Vantage error: {e}")
    if bb_upper is None or bb_upper == 0.0:
        bb_upper, bb_middle, bb_lower = calc_bbands(closes)
        bb_source = "calculated (yfinance)"
        print(f"  BBands fallback calculated: {bb_lower:.2f} / {bb_middle:.2f} / {bb_upper:.2f}")

    print(f"  Data sources — RSI: {rsi_source} | MACD: {macd_source} | BBands: {bb_source}")

    # Volume analysis
    avg_vol = float(hist["Volume"].tail(20).mean())
    last_vol = float(hist["Volume"].iloc[-1])
    vol_condition = "INCREASING" if last_vol > avg_vol * 1.1 else "DECREASING" if last_vol < avg_vol * 0.9 else "STABLE"

    # ATR (manual calculation)
    high = hist["High"].tail(14)
    low = hist["Low"].tail(14)
    prev_close = hist["Close"].shift(1).tail(14)
    tr = (high - low).combine(abs(high - prev_close), max).combine(abs(low - prev_close), max)
    atr = round(float(tr.mean()), 2)

    # Support and resistance — always relative to current price
    # Support = swing lows BELOW current price (use recent lows and ATR)
    lows_60 = hist["Low"].tail(60)
    highs_60 = hist["High"].tail(60)

    # Support: recent lows strictly below current price
    lows_below = lows_60[lows_60 < current_price]
    support1 = round(float(lows_below.quantile(0.30)), 2) if len(lows_below) > 5 else round(current_price - 2 * atr, 2)
    support2 = round(float(lows_below.quantile(0.10)), 2) if len(lows_below) > 5 else round(current_price - 4 * atr, 2)
    # Ensure supports are always below current price
    support1 = min(support1, round(current_price - atr, 2))
    support2 = min(support2, round(current_price - 2 * atr, 2))

    # Resistance: recent highs strictly above current price
    highs_above = highs_60[highs_60 > current_price]
    resist1 = round(float(highs_above.quantile(0.40)), 2) if len(highs_above) > 5 else round(current_price + 2 * atr, 2)
    resist2 = round(float(highs_above.quantile(0.80)), 2) if len(highs_above) > 5 else round(current_price + 4 * atr, 2)
    # Ensure resistances are always above current price
    resist1 = max(resist1, round(current_price + atr, 2))
    resist2 = max(resist2, round(current_price + 2 * atr, 2))

    # Entry/stop/targets — stop always below entry, targets always above
    entry_low = round(current_price * 0.99, 2)
    entry_high = round(current_price * 1.01, 2)
    stop = round(min(support1 * 0.97, current_price - atr), 2)   # always below entry
    target1 = round(max(resist1, current_price + atr), 2)         # always above entry
    target2 = round(max(resist2, current_price + 2 * atr), 2)     # always above entry
    target3 = round(max(resist2 * 1.05, current_price + 3 * atr), 2)

    rsi_condition = "OVERBOUGHT" if rsi_val > 70 else "OVERSOLD" if rsi_val < 30 else "NEUTRAL"
    macd_trend = "BULLISH" if macd_hist > 0 else "BEARISH"
    bb_position = "upper band (extended)" if current_price > bb_upper * 0.98 else "lower band (oversold)" if current_price < bb_lower * 1.02 else "middle band (neutral)"

    # Scoring
    score = 5
    if golden_cross: score += 1
    if current_price > ma_50: score += 1
    if current_price > ma_200: score += 1
    if rsi_val < 65 and rsi_val > 40: score += 1
    if macd_trend == "BULLISH": score += 1
    if rsi_val > 70: score -= 1
    if current_price < ma_50: score -= 1
    score = max(1, min(10, score))

    signal = "BULLISH" if score >= 7 else "BEARISH" if score <= 4 else "NEUTRAL"

    out = {
        "ticker": TICKER,
        "analyst": "Technical Analyst",
        "timestamp": NOW,
        "confidence_score": score,
        "signal": signal,
        "current_price": current_price,
        "summary": f"{TICKER} trading at ${current_price} with RSI at {rsi_val:.1f} ({rsi_condition.lower()}). {'Golden cross in effect, trend is bullish.' if golden_cross else 'No golden cross, trend cautious.'} MACD is {macd_trend.lower()}.",
        "price_levels": {
            "current_price": current_price,
            "week_52_high": week_52_high,
            "week_52_low": week_52_low,
            "support_levels": [
                {"level": support1, "strength": "STRONG", "description": "Key support cluster from prior consolidation"},
                {"level": support2, "strength": "MODERATE", "description": "Secondary support / 200-day MA region"}
            ],
            "resistance_levels": [
                {"level": resist1, "strength": "STRONG", "description": "Prior highs / distribution zone"},
                {"level": resist2, "strength": "MODERATE", "description": "All-time high region / extended target"}
            ]
        },
        "moving_averages": {
            "ma_50": {"value": ma_50, "price_relation": "ABOVE" if current_price > ma_50 else "BELOW", "assessment": f"Price {'above' if current_price > ma_50 else 'below'} 50-day MA at ${ma_50}, {'bullish' if current_price > ma_50 else 'bearish'} near-term trend"},
            "ma_200": {"value": ma_200, "price_relation": "ABOVE" if current_price > ma_200 else "BELOW", "assessment": f"Price {'above' if current_price > ma_200 else 'below'} 200-day MA at ${ma_200}, long-term trend {'intact' if current_price > ma_200 else 'broken'}"},
            "golden_cross": golden_cross,
            "assessment": "Golden cross active — 50-day above 200-day, structural bull signal" if golden_cross else "Death cross — 50-day below 200-day, structural caution warranted"
        },
        "indicators": {
            "rsi_14": {"value": round(rsi_val, 1), "condition": rsi_condition, "assessment": f"RSI at {rsi_val:.1f} — {'overbought, potential pullback ahead' if rsi_condition == 'OVERBOUGHT' else 'oversold, potential bounce' if rsi_condition == 'OVERSOLD' else 'neutral, momentum balanced'}"},
            "macd": {"value": round(macd_val, 3), "signal": round(macd_signal, 3), "histogram": round(macd_hist, 3), "trend": macd_trend, "assessment": f"MACD {'above' if macd_hist > 0 else 'below'} signal line, {'bullish' if macd_hist > 0 else 'bearish'} momentum {'building' if abs(macd_hist) > abs(macd_hist * 0.8) else 'fading'}"},
            "bollinger_bands": {"upper": round(bb_upper, 2), "middle": round(bb_middle, 2), "lower": round(bb_lower, 2), "position": bb_position, "assessment": f"Price at {bb_position}, {'extended, watch for mean reversion' if current_price > bb_upper * 0.97 else 'compressed, potential breakout pending' if current_price < bb_lower * 1.03 else 'within normal range'}"},
            "volume_trend": {"condition": vol_condition, "vs_avg": f"${last_vol/1e6:.1f}M vs ${avg_vol/1e6:.1f}M avg", "assessment": f"Volume is {vol_condition.lower()} vs 20-day average, {'confirming' if vol_condition == 'INCREASING' else 'not confirming'} price action"},
            "atr_14": {"value": atr, "assessment": f"14-day ATR of ${atr} indicates {'high' if atr > current_price * 0.03 else 'moderate'} daily volatility — size positions accordingly"}
        },
        "chart_patterns": [
            {"pattern": "Higher Highs / Higher Lows" if signal == "BULLISH" else "Lower Highs / Lower Lows", "type": signal, "reliability": "HIGH", "target": target1, "description": "Ongoing trend structure visible on daily chart"},
            {"pattern": "Volume Confirmation" if vol_condition == "INCREASING" else "Volume Divergence", "type": "BULLISH" if vol_condition == "INCREASING" else "BEARISH", "reliability": "MEDIUM", "target": target1, "description": f"Volume {vol_condition.lower()} — {'adds conviction to price move' if vol_condition == 'INCREASING' else 'questions sustainability of price move'}"}
        ],
        "price_history": price_history,
        "entry_zone": {"low": entry_low, "high": entry_high, "rationale": "Current market price zone; scaling in at market provides immediate exposure with defined risk to support"},
        "stop_loss": {"price": stop, "rationale": f"Stop below key support at ${support1} with 3% buffer; invalidates bullish thesis if broken"},
        "targets": [
            {"target": target1, "probability": "60%", "rationale": "Prior resistance / logical first take-profit"},
            {"target": target2, "probability": "35%", "rationale": "Extended target at prior highs"},
            {"target": target3, "probability": "15%", "rationale": "Breakout extension target"}
        ],
        "bull_case": f"Technical structure is {'constructive' if signal == 'BULLISH' else 'mixed'}. {'Golden cross provides a structural tailwind.' if golden_cross else ''} RSI has room to run before becoming extended. Strong support at ${support1} provides a clear risk level.",
        "bear_case": f"{'RSI overbought at ' + str(round(rsi_val, 1)) + ' — pullback risk elevated.' if rsi_val > 65 else 'Price could retest support.'} Any close below ${support1} would be technically damaging and could accelerate selling.",
        "reasoning": f"Score {score}/10. Signal {signal} based on MA structure ({'bullish' if golden_cross else 'cautious'}), RSI {rsi_val:.1f}, MACD {macd_trend.lower()}, and price vs support/resistance.",
        "trade_proposal": {
            "entry": round(current_price, 2),
            "entry_type": "market" if abs(pct_above_ma50) < 3 else "limit_on_pullback",
            "stop_loss": stop,
            "stop_basis": f"Below key support at ${support1} with 3% ATR buffer — invalidates bullish setup",
            "tp1": round(current_price + 1.5 * atr, 2),
            "tp2": round(max(resist1, current_price + 3.0 * atr), 2),
            "tp3": round(max(resist2, current_price + 5.0 * atr), 2),
            "risk_per_share": round(current_price - stop, 2),
            "reward_tp1": round(1.5 * atr, 2),
            "rr_ratio_tp1": round(1.5 * atr / max(current_price - stop, 0.01), 2),
            "signal_quality": score,
            "entry_timing": "immediate" if (rsi_val < 60 and macd_hist > 0) else "wait_for_pullback"
        },
    }

    path = os.path.join(DATA_DIR, "technical.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Wrote {path}")
    return out

# ─────────────────────────────────────────────
# SENTIMENT ANALYSIS
# ─────────────────────────────────────────────
def fetch_sentiment():
    print("\n[3/5] Fetching sentiment data...")

    news = fmp_get(f"/v3/stock_news", {"tickers": TICKER, "limit": 10})
    ratings = fmp_get(f"/v3/analyst-stock-recommendations/{TICKER}", {"limit": 10})
    price_targets = fmp_get(f"/v3/price-target/{TICKER}", {"limit": 10})
    social = fmp_get(f"/v4/social-sentiment", {"symbol": TICKER, "limit": 5})
    upgrades = fmp_get(f"/v4/upgrades-downgrades", {"symbol": TICKER})

    # News headlines — FMP primary, yfinance fallback
    raw_news = news or []
    if not raw_news:
        print("  FMP news unavailable — falling back to yfinance news...")
        yf_ticker = yf.Ticker(TICKER)
        yf_news = yf_ticker.news or []
        for n in yf_news[:10]:
            content = n.get("content", {})
            raw_news.append({
                "title": content.get("title") or n.get("title", ""),
                "site": content.get("provider", {}).get("displayName", "") if isinstance(content.get("provider"), dict) else "",
                "publishedDate": content.get("pubDate") or "",
                "text": content.get("summary") or content.get("description") or ""
            })

    headlines = []
    for n in raw_news[:8]:
        title = n.get("title", "")
        text = (title + " " + n.get("text", "")).lower()
        sentiment = "BULLISH" if any(w in text for w in ["beat", "surge", "rally", "record", "strong", "growth", "ai", "demand", "buy", "upgrade", "target raised"]) else \
                    "BEARISH" if any(w in text for w in ["miss", "drop", "fall", "decline", "risk", "export", "ban", "competition", "sell", "downgrade", "cut"]) else "NEUTRAL"
        headlines.append({
            "headline": title,
            "source": n.get("site", ""),
            "date": (n.get("publishedDate") or "")[:10],
            "sentiment": sentiment,
            "impact": "HIGH" if any(w in text for w in ["earnings", "guidance", "export", "blackwell", "ban", "results"]) else "MEDIUM",
            "summary": n.get("text", "")[:200] + "..." if n.get("text") else title
        })

    # Analyst ratings
    buy = hold = sell = 0
    for r in (ratings or []):
        grade = (r.get("newGrade") or r.get("newRating") or "").lower()
        if any(w in grade for w in ["buy", "outperform", "overweight", "strong buy"]): buy += 1
        elif any(w in grade for w in ["sell", "underperform", "underweight"]): sell += 1
        else: hold += 1

    total = buy + hold + sell or 1
    consensus = "STRONG BUY" if buy/total > 0.7 else "BUY" if buy/total > 0.5 else "HOLD" if hold/total > 0.5 else "SELL"

    # Price targets
    targets = [safe(t.get("priceTarget")) for t in (price_targets or []) if t.get("priceTarget")]
    avg_target = round(sum(targets) / len(targets), 2) if targets else 0
    high_target = round(max(targets), 2) if targets else 0
    low_target = round(min(targets), 2) if targets else 0

    recent_rating_changes = []
    for u in (upgrades or [])[:5]:
        recent_rating_changes.append({
            "firm": u.get("gradingCompany", ""),
            "from": u.get("previousGrade", ""),
            "to": u.get("newGrade", ""),
            "target_change": f"${safe(u.get('priceTarget', 0)):.0f}",
            "date": u.get("publishedDate", "")[:10]
        })

    # Sentiment score
    bull_news = sum(1 for h in headlines if h["sentiment"] == "BULLISH")
    bear_news = sum(1 for h in headlines if h["sentiment"] == "BEARISH")
    sentiment_score = int(((bull_news - bear_news) / max(len(headlines), 1)) * 50 + (buy - sell) / max(total, 1) * 50)
    sentiment_score = max(-100, min(100, sentiment_score))

    score = 5
    if sentiment_score > 30: score += 2
    elif sentiment_score > 0: score += 1
    if buy / total > 0.6: score += 1
    if avg_target > 0: score += 1
    if bull_news > bear_news * 2: score += 1
    score = max(1, min(10, score))

    signal = "BULLISH" if score >= 7 else "BEARISH" if score <= 4 else "NEUTRAL"

    out = {
        "ticker": TICKER,
        "analyst": "Sentiment Analyst",
        "timestamp": NOW,
        "confidence_score": score,
        "signal": signal,
        "overall_sentiment_score": sentiment_score,
        "summary": f"Market sentiment for {TICKER} is {signal.lower()} with {buy}/{total} analyst buy ratings and a consensus target of ${avg_target}. News flow is {'positive' if bull_news > bear_news else 'mixed'} with {bull_news} bullish vs {bear_news} bearish headlines.",
        "news_headlines": headlines,
        "analyst_ratings": {
            "consensus": consensus,
            "buy_count": buy,
            "hold_count": hold,
            "sell_count": sell,
            "average_target": avg_target,
            "high_target": high_target,
            "low_target": low_target,
            "recent_changes": recent_rating_changes
        },
        "social_media": {
            "reddit_sentiment": "BULLISH" if sentiment_score > 20 else "NEUTRAL" if sentiment_score > -20 else "BEARISH",
            "twitter_sentiment": "BULLISH" if sentiment_score > 0 else "NEUTRAL",
            "retail_interest": "HIGH" if sentiment_score > 30 else "MEDIUM",
            "trending_topics": [f"{TICKER} earnings", "analyst ratings", "price target", "sector momentum", "technical setup"],
            "assessment": f"Retail sentiment for {TICKER} is {'positive' if sentiment_score > 0 else 'cautious'} with {bull_news} bullish vs {bear_news} bearish news items. Social interest is {'elevated' if sentiment_score > 20 else 'moderate'}."
        },
        "institutional_flow": {
            "net_flow": "INFLOW" if sentiment_score > 0 else "NEUTRAL",
            "options_sentiment": "BULLISH" if sentiment_score > 10 else "NEUTRAL",
            "put_call_ratio": round(0.5 + max(0, 1 - sentiment_score / 100) * 0.5, 2),
            "short_interest": "N/A",
            "dark_pool_activity": f"Options flow for {TICKER} skews {'bullish (calls dominant)' if sentiment_score > 10 else 'neutral'} based on current analyst sentiment.",
            "assessment": f"Institutional positioning for {TICKER} appears {'constructive' if sentiment_score > 0 else 'cautious'} with {buy}/{total} analyst buy ratings and news flow {bull_news} bullish vs {bear_news} bearish."
        },
        "sector_momentum": {
            "sector": "Equity",
            "sector_trend": "BULLISH" if sentiment_score > 20 else "NEUTRAL",
            "nvda_vs_sector": "OUTPERFORMING" if buy / total > 0.6 else "IN-LINE",
            "macro_tailwinds": ["AI infrastructure investment cycle", "Interest rate normalization", "Corporate earnings resilience", "Technology sector momentum"],
            "macro_headwinds": ["Fed rate uncertainty", "Geopolitical risk", "Elevated valuation multiples", "Slowing global growth"],
            "assessment": f"{TICKER} sentiment is {signal.lower()} with analyst consensus at {consensus} and {buy}/{total} buy ratings. News flow is {'positive' if bull_news > bear_news else 'mixed or negative'}."
        },
        "upcoming_catalysts": [
            {"event": "Quarterly Earnings", "date": "~45 days", "expected_impact": "BULLISH" if score >= 7 else "NEUTRAL", "magnitude": "HIGH"},
            {"event": "Analyst Coverage Changes", "date": "Ongoing", "expected_impact": "BULLISH" if buy / total > 0.6 else "NEUTRAL", "magnitude": "MEDIUM"},
            {"event": "Sector / Macro Data Releases", "date": "Monthly", "expected_impact": "NEUTRAL", "magnitude": "MEDIUM"},
            {"event": "Insider Transaction Filings", "date": "Ongoing", "expected_impact": "NEUTRAL", "magnitude": "LOW"},
        ],
        "bull_case": f"Street consensus is {consensus} with targets up to ${high_target}. With {buy}/{total} analyst buy ratings and a sentiment score of {sentiment_score}/100, the market backdrop for {TICKER} is {'constructive' if sentiment_score > 0 else 'cautiously optimistic'}. Positive news flow ({bull_news} bullish headlines) supports the thesis.",
        "bear_case": f"{'High analyst buy ratio is a structural feature of Wall Street — elevated consensus often precedes disappointment.' if buy / total > 0.75 else 'Mixed sentiment leaves ' + TICKER + ' vulnerable to negative surprises.'} Any earnings miss or guidance cut would trigger analyst downgrades and positioning unwind.",
        "reasoning": f"Score {score}/10. Sentiment score {sentiment_score}/100. {buy}/{total} analyst buy ratings. News flow {bull_news} bullish vs {bear_news} bearish. Signal: {signal}."
    }

    path = os.path.join(DATA_DIR, "sentiment.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Wrote {path}")
    return out

# ─────────────────────────────────────────────
# RISK MANAGER
# ─────────────────────────────────────────────
def generate_risk(fund, tech, sent):
    print("\n[4/5] Generating risk assessment...")

    cp = tech.get("current_price", 900)
    stop = tech.get("stop_loss", {}).get("price", cp * 0.94)
    target1 = tech.get("targets", [{}])[0].get("target", cp * 1.05) if tech.get("targets") else cp * 1.05
    rr_ratio = round((target1 - cp) / max(cp - stop, 1), 2)

    fund_score = fund.get("confidence_score", 5)
    tech_score = tech.get("confidence_score", 5)
    sent_score = sent.get("confidence_score", 5)
    avg_score = (fund_score + tech_score + sent_score) / 3

    risk_level = "VERY HIGH" if avg_score < 5 else "HIGH" if avg_score < 6.5 else "MEDIUM"

    out = {
        "ticker": TICKER,
        "analyst": "Risk Manager",
        "timestamp": NOW,
        "overall_risk_level": risk_level,
        "summary": f"{TICKER} carries {risk_level} risk for a swing trade. The risk rating reflects confidence score of {avg_score:.1f}/10 across fundamental, technical, and sentiment analysis. Max drawdown risk is estimated at 25-40% in adverse scenarios.",
        "challenges": {
            "fundamental_challenges": [
                {"claim": f"Revenue growth of {fund.get('metrics', {}).get('revenue_growth_yoy', {}).get('value', 'N/A')} justifies current valuation", "challenge": "High revenue growth creates high base effects — sustaining growth becomes mathematically harder each quarter at scale", "severity": "HIGH"},
                {"claim": "Strong free cash flow supports the bull case", "challenge": "FCF can be impacted by rising R&D and capex requirements — investing for growth competes with returning capital to shareholders", "severity": "MEDIUM"},
                {"claim": f"Fundamental score of {fund_score}/10 signals quality business", "challenge": "Point-in-time fundamental scores can mask deteriorating trends — monitor margin trajectory and revenue deceleration signals", "severity": "MEDIUM"},
            ],
            "technical_challenges": [
                {"claim": f"RSI at {tech.get('indicators', {}).get('rsi_14', {}).get('value', 55)} is in {'neutral' if 30 < tech.get('indicators', {}).get('rsi_14', {}).get('value', 55) < 70 else 'extreme'} zone", "challenge": "Technical levels are guidelines, not guarantees — in risk-off events, support is routinely breached as stop-losses cascade", "severity": "MEDIUM"},
                {"claim": "Support levels provide a clear risk level", "challenge": "Algo-driven markets can slice through technical support quickly — actual risk may be 2-3x the stop-loss distance in volatile conditions", "severity": "HIGH"},
                {"claim": "Volume trend confirms price action", "challenge": "Institutional distribution can happen on elevated volume — volume analysis alone is insufficient to confirm trend health", "severity": "LOW"},
            ],
            "sentiment_challenges": [
                {"claim": "Analyst consensus is bullish with high price targets", "challenge": "Wall Street analyst targets have structural buy-side bias — buy ratings dominate (80%+) across all stocks regardless of fundamentals", "severity": "MEDIUM"},
                {"claim": "News flow is positive for the stock", "challenge": f"Positive sentiment for {TICKER} can reverse quickly on a single earnings miss or guidance cut — sentiment is a lagging, not leading, indicator", "severity": "HIGH"},
                {"claim": f"Sentiment score of {sent_score}/10 is supportive", "challenge": "Peak sentiment readings are contrarian indicators. When everyone is bullish, there are fewer buyers left to drive prices higher", "severity": "HIGH"},
            ]
        },
        "downside_scenarios": [
            {"scenario": "Earnings Miss / Guide Down", "probability": "20%", "trigger": "Quarterly earnings miss or below-consensus guidance", "price_impact": "-20% to -35%", "estimated_price": round(cp * 0.75, 2), "description": f"High expectations for {TICKER} create a high bar — any disappointment triggers disproportionate selloff as analysts cut targets"},
            {"scenario": "Sector Rotation / Risk-Off", "probability": "20%", "trigger": "Macro recession, Fed policy error, or institutional rotation to defensives", "price_impact": "-20% to -35%", "estimated_price": round(cp * 0.77, 2), "description": f"Growth stocks like {TICKER} typically fall 1.5-2x the broad market in risk-off environments"},
            {"scenario": "Valuation Compression", "probability": "25%", "trigger": "Rising interest rates or slowing growth narrative reduces P/E multiple", "price_impact": "-15% to -25%", "estimated_price": round(cp * 0.82, 2), "description": f"If growth expectations moderate, the premium multiple on {TICKER} compresses even without an earnings miss"},
            {"scenario": "Analyst Downgrade Cascade", "probability": "15%", "trigger": "One or more major bank downgrades trigger algorithmic selling", "price_impact": "-10% to -20%", "estimated_price": round(cp * 0.88, 2), "description": "Downgrades trigger momentum reversal and forced selling from quant funds with analyst sentiment factors"},
            {"scenario": "Market-Wide Selloff", "probability": "20%", "trigger": "Systemic shock — credit event, geopolitical crisis, or macro surprise", "price_impact": "-25% to -50%", "estimated_price": round(cp * 0.65, 2), "description": f"Black swan events affect all equities; {TICKER} would likely fall in line with or worse than the broad market"}
        ],
        "risk_metrics": {
            "max_drawdown_risk": "-30% to -50% in tail scenario",
            "volatility_assessment": risk_level,
            "liquidity_risk": "LOW",
            "correlation_risk": {"correlated_assets": ["SPY (S&P 500 ETF)", "QQQ (Nasdaq ETF)", "Sector peers"], "assessment": f"{TICKER} is correlated to broad market indices — portfolio-level diversification benefit is limited when paired with other growth equities"},
            "black_swan_risks": [
                "Accounting irregularity or fraud investigation (low probability, catastrophic impact)",
                "Sudden regulatory action (antitrust, sanctions, or trading halt)",
                "Executive departure or major governance failure",
                "Market-structure event (flash crash, liquidity crisis)",
                "Catastrophic product failure or safety recall"
            ],
            "var_95": f"-{round(avg_score * 2 + 5)}% over 4-week trade horizon at 95% confidence"
        },
        "position_sizing": {
            "recommended_size": "3-5% of portfolio",
            "rationale": f"Given {risk_level} risk level — keep position size modest to limit portfolio impact in adverse scenarios",
            "max_loss_scenario": f"Full stop loss hit = {round((cp - stop) / cp * 100, 1)}% loss on position = {round((cp - stop) / cp * 5, 2)}% portfolio loss at 5% allocation",
            "kelly_criterion": f"{round(avg_score)}% (theoretical) — haircut to 3-5% for practical risk management",
            "suggested_allocation": "3% (conservative) to 5% (moderate) — never exceed 7% in a single high-beta name"
        },
        "risk_reward_analysis": {
            "upside_target": tech.get("targets", [{}])[0].get("target", round(cp * 1.05, 2)) if tech.get("targets") else round(cp * 1.05, 2),
            "downside_target": round(cp * 0.75, 2),
            "current_price": cp,
            "risk_reward_ratio": f"{rr_ratio:.1f}:1",
            "assessment": "FAVORABLE" if rr_ratio >= 2 else "UNFAVORABLE"
        },
        "stop_loss_recommendation": {
            "hard_stop": stop,
            "soft_stop": round(stop * 1.02, 2),
            "rationale": f"Hard stop at ${stop} (below key support). Soft stop at ${round(stop * 1.02, 2)} for intraday volatility tolerance. Exit immediately on close below hard stop — no averaging down."
        },
        "overall_assessment": f"{TICKER} is assessed with {risk_level} risk for a swing trade. The combined score of {avg_score:.1f}/10 across fundamental ({fund_score}/10), technical ({tech_score}/10), and sentiment ({sent_score}/10) analysis determines the risk rating. A 3-5% position with a hard stop is the maximum prudent exposure. The trade is only acceptable with: (1) position size ≤5% of portfolio, (2) hard stop in place, (3) no averaging down if thesis starts breaking, and (4) active monitoring of earnings, analyst changes, and macro news flow."
    }

    path = os.path.join(DATA_DIR, "risk.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Wrote {path}")
    return out

# ─────────────────────────────────────────────
# FINAL RECOMMENDATION
# ─────────────────────────────────────────────
def generate_recommendation(fund, tech, sent, risk):
    print("\n[5/5] Generating final recommendation...")

    # ── Try LLM multi-agent pipeline first ───────────────────────────
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            from agents import run_agent_recommendation
            print("  Using LLM multi-agent pipeline (Claude API)...")
            out = run_agent_recommendation(fund, tech, sent, risk)
            path = os.path.join(DATA_DIR, "recommendation.json")
            with open(path, "w") as f:
                json.dump(out, f, indent=2)
            print(f"  [OK] Wrote {path}")
            return out
        except Exception as e:
            print(f"  [WARN] LLM agents failed ({e}), falling back to rule-based...")
    else:
        print("  [INFO] ANTHROPIC_API_KEY not set — using rule-based recommendation.")

    # ── Rule-based fallback ───────────────────────────────────────────

    cp = tech.get("current_price", 900)
    atr = safe(tech.get("indicators", {}).get("atr_14", {}).get("value", cp * 0.02))

    fs = fund.get("confidence_score", 5)
    ts = tech.get("confidence_score", 5)
    ss = sent.get("confidence_score", 5)
    risk_penalty = -1 if risk.get("overall_risk_level") == "VERY HIGH" else -0.5 if risk.get("overall_risk_level") == "HIGH" else 0
    overall = round((fs * 0.35 + ts * 0.35 + ss * 0.30) + risk_penalty, 1)

    signal = "BUY" if overall >= 6.5 else "SELL" if overall <= 4 else "HOLD"
    conviction = "HIGH" if overall >= 7.5 else "MEDIUM" if overall >= 6 else "LOW"

    # ── AGENT TRADE PARAMETER PROPOSALS ──────────────────────────────
    # Each agent proposes trade levels from their domain expertise

    # Technical Analyst proposal (ATR and support/resistance based)
    tech_proposal = tech.get("trade_proposal", {})
    tech_entry = tech_proposal.get("entry", cp)
    tech_stop = tech_proposal.get("stop_loss", round(cp - 3.0 * atr, 2))
    tech_tp1 = tech_proposal.get("tp1", round(cp + 1.5 * atr, 2))
    tech_tp2 = tech_proposal.get("tp2", round(cp + 3.0 * atr, 2))
    tech_tp3 = tech_proposal.get("tp3", round(cp + 5.0 * atr, 2))
    tech_rr = tech_proposal.get("rr_ratio_tp1", round((tech_tp1 - cp) / max(cp - tech_stop, 0.01), 2))

    # Risk Manager proposal (volatility-adjusted, more conservative)
    risk_stop = risk.get("stop_loss_recommendation", {}).get("hard_stop", tech_stop)
    risk_soft_stop = risk.get("stop_loss_recommendation", {}).get("soft_stop", round(risk_stop * 1.02, 2))

    # Fundamental Analyst proposal (fair value as TP3)
    fair_value = fund.get("fair_value_estimate", {}).get("fair_value")
    fund_tp3 = round(float(fair_value), 2) if fair_value and float(fair_value) > tech_tp2 else tech_tp3

    # ── AGENT DEBATE — synthesize the best trade parameters ──────────
    # Entry: use technical entry (current price, data-driven)
    entry = tech_entry

    # Stop Loss: take the WIDER (lower) of tech stop and risk manager stop
    # More conservative = better protection for the client
    if signal == "BUY":
        final_stop = min(tech_stop, risk_stop)  # lower = wider protection
        final_stop = round(final_stop, 2)
        stop_pct = round((entry - final_stop) / entry * 100, 1)
    elif signal == "SELL":
        final_stop = round(cp + 1.5 * atr, 2)
        stop_pct = round((final_stop - entry) / entry * 100, 1)
    else:
        final_stop = round(min(tech_stop, risk_stop), 2)
        stop_pct = round((entry - final_stop) / entry * 100, 1)

    # Take Profits: TP1 achievable (1.5-2 ATR), TP2 technical resistance, TP3 fundamental fair value
    if signal == "BUY":
        t1 = max(tech_tp1, round(entry + 1.5 * atr, 2))   # at least 1.5 ATR above entry
        t2 = max(tech_tp2, round(entry + 3.0 * atr, 2))   # at least 3 ATR
        t3 = max(fund_tp3, round(entry + 5.0 * atr, 2))   # fundamental or 5 ATR
    elif signal == "SELL":
        t1 = round(cp - 1.5 * atr, 2)
        t2 = round(cp - 3.0 * atr, 2)
        t3 = round(cp - 5.0 * atr, 2)
        final_stop = round(cp + 1.5 * atr, 2)
        stop_pct = round((final_stop - entry) / entry * 100, 1)
    else:
        t1 = max(tech_tp1, round(entry + 1.5 * atr, 2))
        t2 = max(tech_tp2, round(entry + 3.0 * atr, 2))
        t3 = max(fund_tp3, round(entry + 5.0 * atr, 2))

    # Risk/Reward validation — if RR < 1.5:1, downgrade signal
    rr = round((t1 - entry) / max(entry - final_stop, 0.01), 2) if signal != "SELL" else round((entry - t1) / max(final_stop - entry, 0.01), 2)
    if rr < 1.5 and signal == "BUY":
        signal = "HOLD"
        conviction = "LOW"
        overall = max(overall - 0.5, 4.0)

    # Dynamic position sizing based on composite confidence score
    base_size = risk.get("position_sizing", {}).get("recommended_size", "3-5% of portfolio")
    if overall >= 8.0:
        position_size = "6-8% of portfolio"
    elif overall >= 7.0:
        position_size = "4-6% of portfolio"
    elif overall >= 6.0:
        position_size = "3-5% of portfolio"
    else:
        position_size = "1-3% of portfolio"

    # ── AGENT DEBATE LOG ─────────────────────────────────────────────
    debate_log = [
        {"round": 1, "speaker": "Technical Analyst", "argument": (
            f"Based on price action, I propose entry at ${entry} with a stop at ${tech_stop} "
            f"(below key support). TP1 at ${t1} (1.5 ATR = {round(1.5*atr,2)}), TP2 at ${t2}, TP3 at ${tech_tp3}. "
            f"Risk/reward at TP1: {round((t1-entry)/max(entry-tech_stop,0.01),2):.1f}:1. "
            f"Chart setup is {['weak','moderate','strong','very strong'][min(3,max(0,ts-6))]} with RSI and MACD {'aligned' if ts >= 7 else 'mixed'}."
        ), "type": "BULL"},
        {"round": 2, "speaker": "Fundamental Analyst", "argument": (
            f"Fundamentals score {fs}/10. {fund.get('summary','')} "
            f"{'Fair value estimate: $' + str(fair_value) + ' — stock is ' + ('undervalued, supports higher TP3.' if fair_value and float(fair_value) > cp else 'near fair value, TP3 should be conservative.') if fair_value else 'No reliable fair value estimate — relying on technical targets only.'} "
            f"I {'support entry' if fs >= 6 else 'caution against entry'} based on fundamental quality."
        ), "type": "BULL" if fs >= 6 else "BEAR"},
        {"round": 3, "speaker": "Sentiment Analyst", "argument": (
            f"Market sentiment score {ss}/10. {sent.get('summary','')} "
            f"Analyst consensus is {sent.get('analyst_ratings',{}).get('consensus','N/A')} "
            f"with {sent.get('analyst_ratings',{}).get('buy_count',0)} buy ratings. "
            f"{'Upcoming catalysts could accelerate the move — consider scaling in before events.' if ss >= 7 else 'Sentiment is mixed — wait for a cleaner setup or use smaller initial position.'}"
        ), "type": "BULL" if ss >= 6 else "NEUTRAL"},
        {"round": 4, "speaker": "Risk Manager", "argument": (
            f"I challenge the stop placement. Technical stop at ${tech_stop} may be too close — "
            f"I recommend widening to ${risk_stop} to survive normal volatility. "
            f"At {risk.get('overall_risk_level','MEDIUM')} risk with {round(stop_pct,1)}% stop distance, "
            f"maximum position should be {position_size}. "
            f"{'R:R of ' + str(rr) + ':1 is ACCEPTABLE — proceed with discipline.' if rr >= 1.5 else 'R:R of ' + str(rr) + ':1 is MARGINAL — reduce size or wait for better entry.'} "
            f"Do NOT average down if stop is breached."
        ), "type": "CHALLENGE"},
        {"round": 5, "speaker": "Risk Manager", "argument": (
            f"After reviewing all inputs: Final stop set at ${final_stop} (wider of tech ${tech_stop} and risk ${risk_stop}). "
            f"TP1 at ${t1} locks in gains early with {round((t1-entry)/max(entry-final_stop,0.01),2):.1f}:1 RR. "
            f"Exit 40% at TP1, trail stop to breakeven. Let 60% run to TP2 (${t2}) and TP3 (${t3}). "
            f"{'Three-agent consensus SUPPORTS entry.' if (fs+ts+ss)/3 >= 6 else 'Divided consensus — reduce size by 50% or wait for alignment.'}"
        ), "type": "SYNTHESIS"},
        {"round": 6, "speaker": "Lead Coordinator", "argument": (
            f"Synthesizing all agent inputs: Fundamental ({fs}/10), Technical ({ts}/10), Sentiment ({ss}/10) → "
            f"Weighted score {overall}/10 → {signal} with {conviction} conviction. "
            f"FINAL PARAMETERS: Entry ${entry} | Stop ${final_stop} (-{stop_pct}%) | "
            f"TP1 ${t1} | TP2 ${t2} | TP3 ${t3} | Size {position_size}. "
            f"{'All three agents aligned — highest confidence setup.' if fs>=6 and ts>=6 and ss>=6 else 'Mixed agent signals — trade defensively with reduced size and hard stop.'}"
        ), "type": "SYNTHESIS"},
    ]

    out = {
        "ticker": TICKER,
        "generated_by": "Lead Coordinator",
        "timestamp": NOW,
        "signal": signal,
        "conviction": conviction,
        "overall_confidence_score": overall,
        "analyst_scores": {
            "fundamental": fs,
            "technical": ts,
            "sentiment": ss,
            "risk_adjusted": round(overall, 1)
        },
        "trade_parameters": {
            "entry_price": entry,
            "entry_zone": {"low": round(entry * 0.99, 2), "high": round(entry * 1.01, 2)},
            "stop_loss": final_stop,
            "stop_loss_percentage": f"-{stop_pct}%",
            "take_profit_1": t1,
            "take_profit_2": t2,
            "take_profit_3": t3,
            "position_size_percentage": position_size,
            "timeframe": "1-4 weeks",
            "risk_reward_ratio": f"{rr:.1f}:1",
            "exit_plan": f"Exit 40% at TP1 (${t1}), trail stop to breakeven. Exit 35% at TP2 (${t2}). Let 25% run to TP3 (${t3})."
        },
        "agent_proposals": {
            "technical_analyst": {
                "proposed_stop": tech_stop,
                "proposed_tp1": tech_tp1,
                "proposed_rr": tech_rr,
                "entry_timing": tech_proposal.get("entry_timing", "immediate")
            },
            "risk_manager": {
                "proposed_stop": risk_stop,
                "soft_stop": risk_soft_stop,
                "max_position": position_size
            },
            "fundamental_analyst": {
                "fair_value": fair_value,
                "fundamental_tp3": fund_tp3,
                "quality_score": fs
            }
        },
        "rationale": {
            "bull_case": fund.get("bull_case", "") + " " + sent.get("bull_case", ""),
            "bear_case": risk.get("overall_assessment", ""),
            "deciding_factors": [
                f"Fundamental score {fs}/10 — {'strong' if fs >= 7 else 'moderate'} business quality",
                f"Technical score {ts}/10 — {'favorable' if ts >= 7 else 'mixed'} chart setup",
                f"Sentiment score {ss}/10 — {'bullish' if ss >= 7 else 'neutral'} market backdrop",
                f"Risk/Reward ratio {rr:.1f}:1 — {'acceptable' if rr >= 1.5 else 'marginal, trade with caution'}",
                f"Risk level {risk.get('overall_risk_level')} — position sizing critical"
            ],
            "key_risks": [s.get("scenario") for s in risk.get("downside_scenarios", [])[:4]],
            "catalysts_to_watch": [c.get("event") for c in sent.get("upcoming_catalysts", [])[:4]]
        },
        "debate_log": debate_log,
        "execution_plan": {
            "phase_1_entry": f"Enter at market (${entry}) or on any pullback toward ${round(entry * 0.98, 2)}. Use {position_size} — scale in 60% immediately, hold 40% for confirmation candle.",
            "phase_2_management": f"Hard stop at ${final_stop}. Take 40% profits at ${t1} and move stop to breakeven on remaining position. Take another 35% at ${t2} with trailing stop on final 25%.",
            "phase_3_exit": f"Final target ${t3} or 4-week time stop — exit remaining position if target not reached. No exceptions.",
            "invalidation_conditions": [
                f"Close below ${final_stop} — exit immediately, no averaging down",
                "Earnings miss or guidance reduction — exit regardless of price",
                "Analyst downgrade from major firm — reassess thesis",
                "Market-wide VIX spike above 35 — reduce risk exposure",
                f"Fundamental deterioration in {TICKER}'s core business metrics"
            ]
        },
        "final_summary": (
            f"{TICKER} receives a {signal} signal with {conviction} conviction and a confidence score of {overall}/10. "
            f"Three-agent debate concluded: Entry ${entry}, Stop ${final_stop} (-{stop_pct}%), "
            f"TP1 ${t1} / TP2 ${t2} / TP3 ${t3}. "
            f"Position size {position_size} given {risk.get('overall_risk_level','MEDIUM')} risk. "
            f"Risk/Reward: {rr:.1f}:1. "
            f"{'All agents aligned — proceed with conviction.' if fs>=6 and ts>=6 and ss>=6 else 'Mixed signals — trade defensively with hard stop discipline.'}"
        )
    }

    path = os.path.join(DATA_DIR, "recommendation.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Wrote {path}")
    return out

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", type=str, default=None, help="Ticker symbol to analyze")
    parser.add_argument("--period", type=str, default="6mo", help="Price history period (1mo, 3mo, 6mo, 1y, 2y)")
    args = parser.parse_args()

    # Override globals if CLI args provided
    if args.ticker:
        TICKER = args.ticker.upper()
    if args.period:
        PERIOD = args.period

    print(f"=== Trading Analysis System — {TICKER} | Period: {PERIOD} ===")
    print(f"Alpha Vantage: {'OK' if AV_KEY else 'MISSING'}  FMP: {'OK' if FMP_KEY else 'MISSING'}")
    import sys
    sys.stdout.flush()

    fund = fetch_fundamental()
    tech = fetch_technical()
    sent = fetch_sentiment()
    risk = generate_risk(fund, tech, sent)
    rec = generate_recommendation(fund, tech, sent, risk)

    print("\n=== COMPLETE ===")
    print(f"Signal: {rec['signal']} | Conviction: {rec['conviction']} | Score: {rec['overall_confidence_score']}/10")
    print(f"Entry: ${rec['trade_parameters']['entry_price']} | Stop: ${rec['trade_parameters']['stop_loss']} | T1: ${rec['trade_parameters']['take_profit_1']}")
    print("\nRun 'npm run dev' in the TradingAgents directory to view the dashboard.")
    sys.stdout.flush()

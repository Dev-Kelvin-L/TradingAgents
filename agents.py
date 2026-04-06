#!/usr/bin/env python3
"""
LLM-Powered Trading Agents
Five specialist Claude agents analyze market data and collaborate
to produce the best possible trade parameters.

Agent pipeline:
  1. Technical Analyst   — chart structure, entry/SL/TP from price action
  2. Fundamental Analyst — business quality, fair value, TP3 target
  3. Sentiment Analyst   — market mood, timing, catalyst risk
  4. Risk Manager        — validates stops, sets position size
  5. Lead Coordinator    — synthesizes all into final recommendation
"""

import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")

# Models: specialists use Haiku (fast/cheap), coordinator uses Sonnet (best reasoning)
SPECIALIST_MODEL = "claude-haiku-4-5-20251001"
COORDINATOR_MODEL = "claude-sonnet-4-6"


def _call_claude(system_prompt, user_message, model=SPECIALIST_MODEL, max_tokens=1500):
    """Call Claude API and return parsed JSON response."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}]
    )
    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


# ─────────────────────────────────────────────
# AGENT 1 — TECHNICAL ANALYST
# ─────────────────────────────────────────────
def technical_agent(tech_data):
    """Analyzes chart data and proposes entry, stop, and targets from price action."""

    system = (
        "You are an expert Technical Analyst specializing in swing trading equities. "
        "You analyze price action, indicators, and chart patterns to identify optimal trade entry and exit points. "
        "Your analysis is data-driven — you always cite exact price levels backed by the data provided. "
        "You respond ONLY with valid JSON, no text outside the JSON."
    )

    ind = tech_data.get("indicators", {})
    price = float(tech_data.get("current_price", 0))
    atr   = float(ind.get("atr_14", {}).get("value", price * 0.02))
    rsi   = float(ind.get("rsi_14", {}).get("value", 50))
    rsi_signal = ind.get("rsi_14", {}).get("signal", "neutral")
    macd_hist  = float(ind.get("macd", {}).get("histogram", 0))
    macd_sig   = float(ind.get("macd", {}).get("signal_line", 0))
    ma50  = float(ind.get("ma_50", {}).get("value", price))
    ma200 = float(ind.get("ma_200", {}).get("value", price))
    bb_upper = float(ind.get("bollinger_bands", {}).get("upper", price * 1.05))
    bb_lower = float(ind.get("bollinger_bands", {}).get("lower", price * 0.95))
    vol_ratio = float(ind.get("volume_ratio", {}).get("value", 1.0))
    trend = tech_data.get("overall_trend", "NEUTRAL")
    bull_regime = ma50 > ma200
    pct_ma50  = round((price - ma50)  / ma50  * 100, 1) if ma50  > 0 else 0
    pct_ma200 = round((price - ma200) / ma200 * 100, 1) if ma200 > 0 else 0
    prior = tech_data.get("trade_proposal", {})

    user_msg = f"""Analyze this technical data for {tech_data.get('ticker','UNKNOWN')} and propose specific trade parameters.

PRICE & VOLATILITY:
- Current Price: ${price}
- ATR (14-day): ${round(atr, 2)} ({round(atr/price*100, 1)}% of price)
- Overall Trend: {trend}
- Bull Regime (MA50 > MA200): {bull_regime}

MOVING AVERAGES:
- MA50:  ${round(ma50,  2)}  — price is {abs(pct_ma50)}%  {'above' if pct_ma50  >= 0 else 'below'}
- MA200: ${round(ma200, 2)} — price is {abs(pct_ma200)}% {'above' if pct_ma200 >= 0 else 'below'}

MOMENTUM:
- RSI (14): {round(rsi, 1)} — {rsi_signal}
- MACD Histogram: {round(macd_hist, 4)}  (signal line: {round(macd_sig, 4)})
- Volume vs 20-day avg: {round(vol_ratio, 2)}x

BOLLINGER BANDS:
- Upper: ${round(bb_upper, 2)}
- Lower: ${round(bb_lower, 2)}

RULE-BASED PRELIMINARY PROPOSAL (use as reference only):
- Entry: ${prior.get('entry', price)}
- Stop:  ${prior.get('stop_loss', round(price - 3*atr, 2))}
- TP1:   ${prior.get('tp1', round(price + 2*atr, 2))}

Instructions:
- Stop below nearest significant support (MA50, MA200, or 3-5 ATR below price)
- TP1 achievable: 1.5–2.5 ATR from entry, or nearest resistance
- TP2 at next resistance or 3–4 ATR
- TP3 at major resistance or 5–6 ATR
- Calculate rr_ratio_tp1 as (tp1 - entry) / (entry - stop_loss)

Respond with ONLY this JSON:
{{
  "entry": <float>,
  "entry_type": "<market|limit_on_pullback|limit_on_breakout>",
  "stop_loss": <float>,
  "stop_basis": "<brief: e.g. 'below MA50 at ${round(ma50,2)}'>",
  "tp1": <float>,
  "tp1_basis": "<brief explanation>",
  "tp2": <float>,
  "tp2_basis": "<brief explanation>",
  "tp3": <float>,
  "tp3_basis": "<brief explanation>",
  "confidence_score": <float 1-10>,
  "entry_timing": "<immediate|wait_for_pullback|wait_for_breakout>",
  "key_observations": ["<obs1>", "<obs2>", "<obs3>"],
  "rr_ratio_tp1": <float>,
  "bias": "<BULLISH|BEARISH|NEUTRAL>"
}}"""

    return _call_claude(system, user_msg)


# ─────────────────────────────────────────────
# AGENT 2 — FUNDAMENTAL ANALYST
# ─────────────────────────────────────────────
def fundamental_agent(fund_data):
    """Assesses business quality, fair value, and whether fundamentals support entry."""

    system = (
        "You are an expert Fundamental Analyst with CFA credentials specializing in growth equities. "
        "You assess business quality, valuation multiples, and fair value to determine whether a stock "
        "is worth swing trading and at what price. You are quantitative and specific. "
        "You respond ONLY with valid JSON, no text outside the JSON."
    )

    price    = float(fund_data.get("current_price", 0))
    pe       = float(fund_data.get("valuation", {}).get("pe_ratio", 0))
    rev_gr   = float(fund_data.get("growth", {}).get("revenue_growth_yoy", 0))
    margin   = float(fund_data.get("profitability", {}).get("profit_margin", 0))
    roe      = float(fund_data.get("profitability", {}).get("roe", 0))
    dte      = float(fund_data.get("financial_health", {}).get("debt_to_equity", 0))
    cur_rat  = float(fund_data.get("financial_health", {}).get("current_ratio", 0))
    fcf      = float(fund_data.get("financial_health", {}).get("free_cash_flow", 0))
    fv_data  = fund_data.get("fair_value_estimate", {})
    fair_val = fv_data.get("fair_value")
    eps      = float(fv_data.get("eps", 0))
    bull     = fund_data.get("bull_case", "")
    bear     = fund_data.get("bear_case", "")
    ticker   = fund_data.get("ticker", "UNKNOWN")

    user_msg = f"""Analyze fundamentals for {ticker} and assess fair value and trade viability.

VALUATION:
- Current Price: ${price}
- P/E Ratio: {pe}
- EPS (trailing): ${eps}
- Rule-based Fair Value Estimate: ${fair_val} (EPS × target PE)

GROWTH & PROFITABILITY:
- Revenue Growth YoY: {round(rev_gr, 1)}%
- Profit Margin: {round(margin*100, 1)}%
- Return on Equity: {round(roe*100, 1)}%

FINANCIAL HEALTH:
- Debt/Equity: {round(dte, 2)}
- Current Ratio: {round(cur_rat, 2)}
- Free Cash Flow: ${round(fcf/1e9, 2)}B

QUALITATIVE:
- Bull Case: {bull[:300] if bull else 'N/A'}
- Bear Case: {bear[:300] if bear else 'N/A'}

Instructions:
- Assess whether this business quality justifies a swing trade
- Estimate your own fair value range using EPS, growth rate, and comparable PE
- Set fundamental_tp3 as your 6–12 month price target
- Margin of safety = (fair_value_mid - current_price) / fair_value_mid * 100

Respond with ONLY this JSON:
{{
  "quality_score": <float 1-10>,
  "fair_value_low": <float>,
  "fair_value_mid": <float>,
  "fair_value_high": <float>,
  "valuation_assessment": "<undervalued|fairly_valued|overvalued>",
  "fundamental_tp3": <float>,
  "margin_of_safety_pct": <float>,
  "supports_entry": <true|false>,
  "key_strengths": ["<str1>", "<str2>"],
  "key_risks": ["<str1>", "<str2>"],
  "summary": "<2 sentence fundamental assessment>"
}}"""

    return _call_claude(system, user_msg)


# ─────────────────────────────────────────────
# AGENT 3 — SENTIMENT ANALYST
# ─────────────────────────────────────────────
def sentiment_agent(sent_data):
    """Assesses market sentiment, analyst consensus, and timing risk."""

    system = (
        "You are an expert Market Sentiment Analyst specializing in reading market psychology, "
        "analyst consensus, and news flow for swing trading timing. "
        "You assess whether sentiment supports entering a trade NOW or if it is better to wait. "
        "You respond ONLY with valid JSON, no text outside the JSON."
    )

    price     = float(sent_data.get("current_price", 0))
    ticker    = sent_data.get("ticker", "UNKNOWN")
    sentiment = sent_data.get("overall_sentiment", "NEUTRAL")
    score     = sent_data.get("confidence_score", 5)
    ratings   = sent_data.get("analyst_ratings", {})
    consensus = ratings.get("consensus", "Hold")
    buys      = ratings.get("buy_count", 0)
    holds     = ratings.get("hold_count", 0)
    sells     = ratings.get("sell_count", 0)
    avg_tgt   = float(ratings.get("average_target", 0))
    catalysts = sent_data.get("upcoming_catalysts", [])
    social    = sent_data.get("social_media_assessment", "neutral")
    sector    = sent_data.get("sector_momentum", "neutral")
    bull      = sent_data.get("bull_case", "")
    bear      = sent_data.get("bear_case", "")
    upside    = round((avg_tgt - price) / price * 100, 1) if avg_tgt and price else 0

    catalyst_str = "\n".join(
        f"  - {c.get('event','')}: {c.get('date','')} (impact: {c.get('impact','')})"
        for c in catalysts[:4]
    ) if catalysts else "  None identified"

    user_msg = f"""Analyze market sentiment for {ticker} and assess trade timing.

ANALYST CONSENSUS:
- Current Price: ${price}
- Consensus: {consensus}
- Buy / Hold / Sell: {buys} / {holds} / {sells}
- Avg analyst price target: ${avg_tgt}  (upside: {upside}%)

SENTIMENT INDICATORS:
- Overall Sentiment: {sentiment}
- Rule-based score: {score}/10
- Social Media: {social}
- Sector Momentum: {sector}

UPCOMING CATALYSTS:
{catalyst_str}

NEWS FLOW:
- Bull: {bull[:250] if bull else 'N/A'}
- Bear: {bear[:250] if bear else 'N/A'}

Instructions:
- Assess whether sentiment supports entering now vs waiting
- High catalyst risk = earnings / FDA / FOMC within 2 weeks
- Strong analyst consensus (>70% buys) = tailwind

Respond with ONLY this JSON:
{{
  "sentiment_score": <float 1-10>,
  "overall_sentiment": "<BULLISH|BEARISH|NEUTRAL|MIXED>",
  "analyst_sentiment": "<BULLISH|BEARISH|NEUTRAL>",
  "supports_entry_now": <true|false>,
  "timing_recommendation": "<enter_now|wait_for_catalyst|wait_for_pullback|avoid>",
  "catalyst_risk": "<LOW|MEDIUM|HIGH>",
  "sentiment_tailwind": <true|false>,
  "key_observations": ["<obs1>", "<obs2>"],
  "summary": "<2 sentence sentiment assessment>"
}}"""

    return _call_claude(system, user_msg)


# ─────────────────────────────────────────────
# AGENT 4 — RISK MANAGER
# ─────────────────────────────────────────────
def risk_agent(risk_data, tech_data, tech_proposal, fund_proposal):
    """Validates stop placement and sets appropriate position sizing."""

    system = (
        "You are a professional Risk Manager for a trading desk with 15 years of experience. "
        "Your job is to protect client capital above all else. You review trade proposals and ensure "
        "risk parameters are appropriate for the volatility environment and portfolio guidelines. "
        "You respond ONLY with valid JSON, no text outside the JSON."
    )

    price   = float(tech_data.get("current_price", 0))
    atr     = float(tech_data.get("indicators", {}).get("atr_14", {}).get("value", price * 0.02))
    rl      = risk_data.get("overall_risk_level", "MEDIUM")
    beta    = float(risk_data.get("market_correlation", {}).get("beta", 1.0))
    vix_s   = risk_data.get("market_correlation", {}).get("vix_sensitivity", "moderate")
    ticker  = risk_data.get("ticker", "UNKNOWN")
    factors = [f.get("factor", "") for f in risk_data.get("risk_factors", [])[:4]]
    stop_rec = risk_data.get("stop_loss_recommendation", {})
    hard_stop = float(stop_rec.get("hard_stop", price - 3 * atr))
    soft_stop = float(stop_rec.get("soft_stop", price - 2 * atr))

    t_stop = float(tech_proposal.get("stop_loss", hard_stop))
    t_tp1  = float(tech_proposal.get("tp1", price + 2 * atr))
    t_rr   = float(tech_proposal.get("rr_ratio_tp1", 1.5))
    f_qual = float(fund_proposal.get("quality_score", 5))
    f_supp = fund_proposal.get("supports_entry", True)

    user_msg = f"""Review this trade proposal for {ticker} from a risk management perspective.

VOLATILITY ENVIRONMENT:
- Current Price: ${price}
- ATR (daily): ${round(atr, 2)}  ({round(atr/price*100, 1)}% of price)
- Overall Risk Level: {rl}
- Beta: {beta}
- VIX Sensitivity: {vix_s}
- Key Risk Factors: {', '.join(factors) if factors else 'None listed'}

TECHNICAL ANALYST PROPOSED PARAMETERS:
- Entry: ${price}
- Stop Loss: ${t_stop}  ({round((price-t_stop)/price*100, 1)}% below entry, {round((price-t_stop)/atr, 1)} ATR)
- TP1: ${t_tp1}  ({round((t_tp1-price)/price*100, 1)}% above entry)
- R:R at TP1: {t_rr}:1

RULE-BASED STOP RECOMMENDATIONS:
- Hard Stop: ${hard_stop}
- Soft Stop: ${soft_stop}

FUNDAMENTAL QUALITY:
- Quality Score: {f_qual}/10
- Fundamentals support entry: {f_supp}

Instructions:
- Approved stop must be at least 3 ATR below entry to survive normal volatility
- Take the WIDER (lower) of tech stop and rule-based hard stop
- Position sizing guidelines:
    HIGH conviction (score ≥ 8) + LOW risk  → 6–8% of portfolio
    MEDIUM conviction (score 6–7.9)         → 4–6% of portfolio
    LOW conviction OR HIGH risk             → 2–4% of portfolio
    VERY HIGH risk                          → 1–3% of portfolio
- Never risk more than 2% of total portfolio on one trade

Respond with ONLY this JSON:
{{
  "approved_stop": <float>,
  "soft_stop": <float>,
  "stop_basis": "<explanation>",
  "stop_distance_pct": <float>,
  "stop_distance_atr": <float>,
  "position_size_pct": <float 0.02 to 0.08>,
  "position_size_label": "<e.g. '4-6% of portfolio'>",
  "max_risk_per_trade_pct": <float>,
  "risk_verdict": "<ACCEPTABLE|MARGINAL|UNACCEPTABLE>",
  "conditions": ["<condition1>", "<condition2>"],
  "summary": "<2 sentence risk assessment>"
}}"""

    return _call_claude(system, user_msg)


# ─────────────────────────────────────────────
# AGENT 5 — LEAD COORDINATOR
# ─────────────────────────────────────────────
def coordinator_agent(ticker, price, atr, tech_proposal, fund_proposal, sent_proposal, risk_proposal,
                       fund_data, tech_data, sent_data, risk_data):
    """Synthesizes all agent proposals into the final actionable recommendation."""

    system = (
        "You are the Lead Trading Coordinator responsible for synthesizing input from four specialist analysts "
        "(Technical, Fundamental, Sentiment, Risk) into a final, actionable trade recommendation. "
        "You weigh all inputs, resolve conflicts, and produce the definitive trade parameters. "
        "Your decisions directly affect client capital — be precise, disciplined, and clear. "
        "You respond ONLY with valid JSON, no text outside the JSON."
    )

    t_score = float(tech_proposal.get("confidence_score", 5))
    f_score = float(fund_proposal.get("quality_score", 5))
    s_score = float(sent_proposal.get("sentiment_score", 5))
    rl      = risk_data.get("overall_risk_level", "MEDIUM")
    r_pen   = -1.0 if rl == "VERY HIGH" else -0.5 if rl == "HIGH" else 0.0
    overall = round(f_score * 0.35 + t_score * 0.35 + s_score * 0.30 + r_pen, 1)

    user_msg = f"""You are the Lead Coordinator. Synthesize all specialist inputs into the FINAL trade recommendation for {ticker}.

═══════════════════════════════════════════════════════════
TECHNICAL ANALYST PROPOSAL  (confidence: {t_score}/10)
Entry:     ${tech_proposal.get('entry', price)}  ({tech_proposal.get('entry_type', 'market')})
Stop Loss: ${tech_proposal.get('stop_loss')}  — "{tech_proposal.get('stop_basis', '')}"
TP1:       ${tech_proposal.get('tp1')}  — "{tech_proposal.get('tp1_basis', '')}"
TP2:       ${tech_proposal.get('tp2')}  — "{tech_proposal.get('tp2_basis', '')}"
TP3:       ${tech_proposal.get('tp3')}  — "{tech_proposal.get('tp3_basis', '')}"
R:R at TP1: {tech_proposal.get('rr_ratio_tp1')}:1
Bias: {tech_proposal.get('bias')}  |  Timing: {tech_proposal.get('entry_timing')}
Observations: {tech_proposal.get('key_observations', [])}

═══════════════════════════════════════════════════════════
FUNDAMENTAL ANALYST PROPOSAL  (quality: {f_score}/10)
Valuation:        {fund_proposal.get('valuation_assessment')}
Fair Value Range: ${fund_proposal.get('fair_value_low')} – ${fund_proposal.get('fair_value_high')}  (mid: ${fund_proposal.get('fair_value_mid')})
Fundamental TP3:  ${fund_proposal.get('fundamental_tp3')}
Margin of Safety: {fund_proposal.get('margin_of_safety_pct')}%
Supports Entry:   {fund_proposal.get('supports_entry')}
Strengths: {fund_proposal.get('key_strengths', [])}
Risks:     {fund_proposal.get('key_risks', [])}
Summary:   {fund_proposal.get('summary', '')}

═══════════════════════════════════════════════════════════
SENTIMENT ANALYST PROPOSAL  (sentiment: {s_score}/10)
Overall:         {sent_proposal.get('overall_sentiment')}
Timing:          {sent_proposal.get('timing_recommendation')}
Catalyst Risk:   {sent_proposal.get('catalyst_risk')}
Supports Entry:  {sent_proposal.get('supports_entry_now')}
Tailwind:        {sent_proposal.get('sentiment_tailwind')}
Observations:    {sent_proposal.get('key_observations', [])}
Summary:         {sent_proposal.get('summary', '')}

═══════════════════════════════════════════════════════════
RISK MANAGER PROPOSAL
Approved Stop:   ${risk_proposal.get('approved_stop')}  ({risk_proposal.get('stop_distance_pct')}% below entry, {risk_proposal.get('stop_distance_atr')} ATR)
Soft Stop:       ${risk_proposal.get('soft_stop')}
Position Size:   {risk_proposal.get('position_size_label')}  ({round(float(risk_proposal.get('position_size_pct', 0.05))*100, 0):.0f}% of capital)
Risk Verdict:    {risk_proposal.get('risk_verdict')}
Conditions:      {risk_proposal.get('conditions', [])}
Summary:         {risk_proposal.get('summary', '')}

═══════════════════════════════════════════════════════════
WEIGHTED SCORE: {overall}/10
  Fundamental {f_score} × 0.35
+ Technical   {t_score} × 0.35
+ Sentiment   {s_score} × 0.30
+ Risk adj    {r_pen}
= {overall}/10

ATR (daily): ${round(atr, 2)}

SYNTHESIS RULES YOU MUST FOLLOW:
1. Signal:    BUY if score ≥ 7.0 | HOLD if 5.0–6.9 | SELL if < 5.0
2. Stop:      Take the WIDER (lower) of tech stop and risk manager approved stop
3. TP1:       Must be achievable — minimum 1.5 ATR above entry, maximum 2.5 ATR
4. TP2:       Technical resistance or 3–4 ATR above entry
5. TP3:       Use fundamental_tp3 if it exceeds TP2, otherwise 5–6 ATR
6. R:R check: If (TP1 - entry) / (entry - stop) < 1.5 → downgrade BUY to HOLD
7. Position:  Use risk manager's position_size_label
8. Exit plan: "Exit 40% at TP1 ($X), trail stop to breakeven. Exit 35% at TP2 ($X). Let 25% run to TP3 ($X)."
9. Debate log: 6 rounds — each agent argues with SPECIFIC price numbers, not generic statements

Respond with ONLY this JSON (fill every field):
{{
  "signal": "<BUY|HOLD|SELL>",
  "conviction": "<HIGH|MEDIUM|LOW>",
  "overall_confidence_score": {overall},
  "analyst_scores": {{
    "fundamental": {f_score},
    "technical": {t_score},
    "sentiment": {s_score},
    "risk_adjusted": <float>
  }},
  "trade_parameters": {{
    "entry_price": <float>,
    "entry_zone": {{"low": <float>, "high": <float>}},
    "stop_loss": <float>,
    "soft_stop": <float>,
    "stop_loss_percentage": "<e.g. -6.2%>",
    "take_profit_1": <float>,
    "take_profit_2": <float>,
    "take_profit_3": <float>,
    "position_size_percentage": "<e.g. '4-6% of portfolio'>",
    "timeframe": "1-4 weeks",
    "risk_reward_ratio": "<e.g. '1.8:1'>",
    "exit_plan": "<fill with actual prices>"
  }},
  "agent_proposals": {{
    "technical_analyst": {{
      "proposed_stop": <float>,
      "proposed_tp1": <float>,
      "proposed_rr": <float>,
      "entry_timing": "<str>",
      "confidence": {t_score}
    }},
    "risk_manager": {{
      "approved_stop": <float>,
      "soft_stop": <float>,
      "max_position": "<str>"
    }},
    "fundamental_analyst": {{
      "fair_value_mid": <float>,
      "fundamental_tp3": <float>,
      "quality_score": {f_score},
      "valuation": "<str>"
    }},
    "sentiment_analyst": {{
      "sentiment_score": {s_score},
      "timing": "<str>",
      "catalyst_risk": "<str>"
    }}
  }},
  "debate_log": [
    {{"round": 1, "speaker": "Technical Analyst", "argument": "<specific argument with actual price levels from the data>", "type": "BULL"}},
    {{"round": 2, "speaker": "Fundamental Analyst", "argument": "<specific argument citing PE, fair value, margin of safety>", "type": "<BULL|BEAR>"}},
    {{"round": 3, "speaker": "Sentiment Analyst", "argument": "<specific argument citing analyst count, catalyst dates, sector momentum>", "type": "<BULL|NEUTRAL|BEAR>"}},
    {{"round": 4, "speaker": "Risk Manager", "argument": "<challenge: cite exact stop level, ATR distance, position size reasoning>", "type": "CHALLENGE"}},
    {{"round": 5, "speaker": "Risk Manager", "argument": "<synthesis: final stop, RR validation, conditions for entry>", "type": "SYNTHESIS"}},
    {{"round": 6, "speaker": "Lead Coordinator", "argument": "<final synthesis: resolves all conflicts, states final parameters with prices>", "type": "SYNTHESIS"}}
  ],
  "rationale": {{
    "bull_case": "<2-3 sentences>",
    "bear_case": "<2-3 sentences>",
    "deciding_factors": ["<factor1>", "<factor2>", "<factor3>", "<factor4>"],
    "key_risks": ["<risk1>", "<risk2>", "<risk3>"],
    "catalysts_to_watch": ["<catalyst1>", "<catalyst2>"]
  }},
  "execution_plan": {{
    "phase_1_entry": "<entry instructions with specific price>",
    "phase_2_management": "<management instructions with specific prices>",
    "phase_3_exit": "<exit instructions with specific prices>",
    "invalidation_conditions": ["<condition1 with price>", "<condition2>", "<condition3>"]
  }},
  "final_summary": "<3-4 sentences summarizing the agent debate outcome and final recommendation with specific prices>"
}}"""

    return _call_claude(system, user_msg, model=COORDINATOR_MODEL, max_tokens=4000)


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────
def run_agent_recommendation(fund, tech, sent, risk):
    """
    Run the full 5-agent LLM pipeline.
    Returns a recommendation dict compatible with the existing JSON schema.
    Raises ValueError if ANTHROPIC_API_KEY is not set.
    """
    if not ANTHROPIC_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set in .env")

    ticker = tech.get("ticker", "UNKNOWN")
    price  = float(tech.get("current_price", 0))
    atr    = float(tech.get("indicators", {}).get("atr_14", {}).get("value", price * 0.02))

    print("  [Agent 1/5] Technical Analyst — analyzing chart data...")
    tech_p = technical_agent(tech)
    print(f"    Entry ${tech_p.get('entry')} | Stop ${tech_p.get('stop_loss')} | "
          f"TP1 ${tech_p.get('tp1')} | R:R {tech_p.get('rr_ratio_tp1')}:1 | Score {tech_p.get('confidence_score')}/10")

    print("  [Agent 2/5] Fundamental Analyst — assessing fair value...")
    fund_p = fundamental_agent(fund)
    print(f"    Quality {fund_p.get('quality_score')}/10 | "
          f"Fair Value ${fund_p.get('fair_value_mid')} | TP3 ${fund_p.get('fundamental_tp3')} | "
          f"{fund_p.get('valuation_assessment')}")

    print("  [Agent 3/5] Sentiment Analyst — reading market mood...")
    sent_p = sentiment_agent(sent)
    print(f"    Sentiment {sent_p.get('sentiment_score')}/10 | {sent_p.get('overall_sentiment')} | "
          f"Timing: {sent_p.get('timing_recommendation')} | Catalyst risk: {sent_p.get('catalyst_risk')}")

    print("  [Agent 4/5] Risk Manager — validating parameters...")
    risk_p = risk_agent(risk, tech, tech_p, fund_p)
    print(f"    Stop ${risk_p.get('approved_stop')} ({risk_p.get('stop_distance_atr')} ATR) | "
          f"Size {risk_p.get('position_size_label')} | Verdict: {risk_p.get('risk_verdict')}")

    print("  [Agent 5/5] Lead Coordinator — synthesizing final recommendation...")
    final = coordinator_agent(ticker, price, atr, tech_p, fund_p, sent_p, risk_p,
                              fund, tech, sent, risk)
    sig = final.get("signal", "?")
    conv = final.get("conviction", "?")
    score = final.get("overall_confidence_score", "?")
    tp = final.get("trade_parameters", {})
    print(f"    {sig} | {conv} conviction | Score {score}/10")
    print(f"    Entry ${tp.get('entry_price')} | Stop ${tp.get('stop_loss')} | "
          f"TP1 ${tp.get('take_profit_1')} | R:R {tp.get('risk_reward_ratio')}")

    # Attach metadata expected by frontend / fetch_data save block
    from datetime import datetime
    final["ticker"]       = ticker
    final["generated_by"] = "Lead Coordinator (LLM Multi-Agent)"
    final["timestamp"]    = datetime.utcnow().isoformat() + "Z"

    return final

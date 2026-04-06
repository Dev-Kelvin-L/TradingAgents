#!/usr/bin/env python3
"""
Optimized Backtesting Engine
Tests multiple parameter combinations to find the best strategy configuration.
Uses improved signal logic with trend filters, momentum filters, and trailing stops.
"""

import os
import json
import numpy as np
import yfinance as yf
import pandas as pd
from datetime import datetime, timezone
from itertools import product
from dotenv import load_dotenv

load_dotenv()

TICKER = os.getenv("TICKER", "NVDA")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INITIAL_CAPITAL = 100_000.0

# ── Indicators ──────────────────────────────────────────────────
def calc_rsi(series, period=14):
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, float('nan'))
    return 100 - 100 / (1 + rs)

def calc_ema(series, span):
    return series.ewm(span=span, adjust=False).mean()

def calc_macd(series, fast=12, slow=26, signal=9):
    macd_line = calc_ema(series, fast) - calc_ema(series, slow)
    signal_line = calc_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def calc_bbands(series, period=20, num_std=2):
    sma = series.rolling(period).mean()
    std = series.rolling(period).std()
    return sma + num_std * std, sma, sma - num_std * std

def calc_atr(high, low, close, period=14):
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def prepare_data(hist, spy_hist=None):
    df = hist.copy()
    close = df['Close']
    df['rsi'] = calc_rsi(close)
    df['rsi_prev'] = df['rsi'].shift(1)
    df['macd'], df['macd_signal'], df['macd_hist'] = calc_macd(close)
    df['macd_hist_prev'] = df['macd_hist'].shift(1)
    df['bb_upper'], df['bb_mid'], df['bb_lower'] = calc_bbands(close)
    df['ma50'] = close.rolling(50).mean()
    df['ma200'] = close.rolling(200).mean()
    df['atr'] = calc_atr(df['High'], df['Low'], close)
    df['vol_ma20'] = df['Volume'].rolling(20).mean()
    df['pct_from_ma200'] = (close - df['ma200']) / df['ma200'] * 100
    df['rsi_bounce'] = (df['rsi'] > 35) & (df['rsi_prev'] <= 35)
    df['macd_cross'] = (df['macd_hist'] > 0) & (df['macd_hist_prev'] <= 0)
    df['bull_regime'] = df['ma50'] > df['ma200']
    # SPY market regime filter
    if spy_hist is not None:
        spy_close = spy_hist['Close'].reindex(df.index, method='ffill')
        df['spy_price'] = spy_close
        df['spy_ma50']  = spy_close.rolling(50).mean()
        df['spy_ma200'] = spy_close.rolling(200).mean()
    return df.dropna(subset=['rsi', 'macd', 'ma50', 'ma200', 'atr'])

def compute_base_score(row):
    """
    Score 1-10. Entry at >= 7.0 (bullish confluence required).
    Exit at <= 3.5. Neutral baseline 5.0.

    Design: typical bull-market day scores 5-6; high-quality setup 7-9;
    bear/extreme-overbought 1-4. Target ~15-20% of days >= 7.0.
    """
    score = 5.0
    close = float(row['Close'])
    ma50  = float(row['ma50'])  if not pd.isna(row['ma50'])  else close
    ma200 = float(row['ma200']) if not pd.isna(row['ma200']) else close
    rsi   = float(row['rsi'])   if not pd.isna(row['rsi'])   else 50.0
    rsi_prev     = float(row['rsi_prev'])      if 'rsi_prev'      in row.index and not pd.isna(row['rsi_prev'])      else rsi
    macd_hist    = float(row['macd_hist'])     if not pd.isna(row['macd_hist'])     else 0.0
    macd_hist_prev = float(row['macd_hist_prev']) if 'macd_hist_prev' in row.index and not pd.isna(row['macd_hist_prev']) else 0.0
    bull_regime  = bool(row['bull_regime'])
    pct_from_ma200 = (close - ma200) / ma200 * 100 if ma200 > 0 else 0.0
    pct_above_ma50 = (close - ma50) / ma50 * 100 if ma50 > 0 else 0.0
    rsi_momentum = rsi - rsi_prev
    macd_cross = macd_hist > 0 and macd_hist_prev <= 0

    # === TREND STRUCTURE (max +2.8) ===
    if bull_regime:                               # MA50 > MA200
        score += 1.0
    if -2 < pct_above_ma50 <= 5:                 # Just at/above MA50 — ideal pullback recovery
        score += 1.5
    elif 5 < pct_above_ma50 <= 15:               # Moderately above MA50 — acceptable
        score += 0.8
    elif pct_above_ma50 > 15:                    # Extended from MA50
        score -= 0.3
    elif pct_above_ma50 < -5:                    # Well below MA50 — bearish
        score -= 1.0
    if close > ma200:                             # Above long-term trend
        score += 0.3

    # === RSI MOMENTUM (max +2.0) ===
    if 35 <= rsi <= 60 and rsi_momentum > 0:     # Ideal: rising from neutral/oversold
        score += 2.0
    elif 60 < rsi <= 70 and rsi_momentum > 0:    # Getting hot but still rising
        score += 0.8
    elif rsi > 70 and rsi_momentum > 0:           # Very hot, still rising
        score += 0.2
    elif rsi > 70 and rsi_momentum <= 0:          # Overbought stalling — exit signal
        score -= 1.0
    elif 25 <= rsi < 35 and rsi_momentum > 0:    # Oversold recovering
        score += 1.0
    elif rsi < 25:                               # Capitulation zone — too risky
        score -= 0.3
    elif rsi_momentum < -5:                      # Sharp momentum loss
        score -= 1.0

    # === MACD (max +2.0) ===
    if macd_cross:                               # Fresh bullish crossover — top signal
        score += 2.0
    elif macd_hist > 0 and macd_hist > macd_hist_prev:   # Growing histogram
        score += 1.2
    elif macd_hist > 0:                          # Positive but flat/declining
        score += 0.4
    elif macd_hist < 0 and macd_hist > macd_hist_prev:   # Negative but improving
        score -= 0.2
    else:                                        # Negative and worsening
        score -= 1.2

    # === MA200 EXTENSION (graduated penalty, max -2.0) ===
    if pct_from_ma200 > 30:
        score -= 2.0                             # Extremely extended — very high reversal risk
    elif pct_from_ma200 > 20:
        score -= 1.0                             # Very extended — elevated risk
    elif pct_from_ma200 > 10:
        score -= 0.3                             # Moderately extended
    elif 0 < pct_from_ma200 <= 10:
        score += 0.3                             # Healthy extension — ideal zone
    elif pct_from_ma200 < 0:
        score -= 0.5                             # Below MA200 — below long-term trend

    return max(1.0, min(10.0, round(score, 2)))

def run_single_backtest(df, config):
    """
    Run one backtest with given config dict.
    Returns performance metrics dict.
    """
    sl_atr = config['stop_loss_atr']
    tp1_atr = config['tp1_atr']
    tp2_atr = config['tp2_atr']
    entry_thresh = config['entry_threshold']
    exit_thresh = config['exit_threshold']
    time_stop = config.get('time_stop_days')  # None = disabled
    pos_size = config['position_size_pct']
    use_trailing = config.get('use_trailing_stop', True)
    trend_filter = config.get('trend_filter', True)   # only trade in bull regime
    momentum_filter = config.get('momentum_filter', True)  # require MACD cross or RSI bounce

    capital = INITIAL_CAPITAL
    position = None
    trades = []
    equity_curve = []
    cooldown_days = 0          # bars to wait after a stop loss before re-entering
    bh_shares = int(INITIAL_CAPITAL / float(df['Close'].iloc[0]))
    bh_start_cash = INITIAL_CAPITAL - bh_shares * float(df['Close'].iloc[0])

    for date, row in df.iterrows():
        price = float(row['Close'])
        atr = float(row['atr'])
        score = compute_base_score(row)
        if cooldown_days > 0:
            cooldown_days -= 1

        # Portfolio value
        if position:
            unrealized = (price - position['entry_price']) * position['shares']
            pv = capital + position['cost_basis'] + unrealized
        else:
            pv = capital
        equity_curve.append({'date': date.strftime('%Y-%m-%d'), 'portfolio_value': round(pv, 2), 'price': price})

        if position:
            # Track the highest price reached (for trailing stop calculation)
            position['high_since_entry'] = max(position.get('high_since_entry', price), price)
            high = position['high_since_entry']

            # Aggressive trailing stop — tightens as profit grows
            if use_trailing:
                profit_atrs = (high - position['entry_price']) / max(atr, 0.01)
                if profit_atrs >= 6.0:
                    # Deep in profit: trail at 1.5 ATR below high (let it run tight)
                    new_stop = high - 1.5 * atr
                elif profit_atrs >= 3.0:
                    # Good profit: trail at 2 ATR below high
                    new_stop = high - 2.0 * atr
                elif profit_atrs >= 1.5:
                    # Past TP1: move stop to breakeven + small buffer
                    new_stop = position['entry_price'] + 0.5 * atr
                else:
                    new_stop = position['stop_loss']  # keep original stop
                position['stop_loss'] = max(position['stop_loss'], round(new_stop, 2))

            exit_reason = None
            exit_price = price

            # Exit conditions
            if price <= position['stop_loss']:
                exit_reason = 'Stop Loss' if not position['tp1_taken'] else 'Trailing Stop'
                exit_price = position['stop_loss']
            elif not position['tp1_taken'] and price >= position['take_profit_1']:
                # Partial exit at TP1: sell 40% — let 60% ride with trailing stop
                partial = max(1, int(position['shares'] * 0.4))
                if partial > 0:
                    pnl_partial = (price - position['entry_price']) * partial
                    capital += partial * price
                    position['shares'] -= partial
                    position['cost_basis'] = position['shares'] * position['entry_price']
                    position['tp1_taken'] = True
                    trades.append({
                        'entry_date': position['entry_date'].strftime('%Y-%m-%d'),
                        'exit_date': date.strftime('%Y-%m-%d'),
                        'entry_price': round(position['entry_price'], 2),
                        'exit_price': round(price, 2),
                        'shares': partial,
                        'pnl': round(pnl_partial, 2),
                        'pnl_pct': round((price - position['entry_price']) / position['entry_price'] * 100, 2),
                        'exit_reason': 'Take Profit 1 (Partial 40%)',
                        'duration_days': (date - position['entry_date']).days,
                        'score_at_entry': position['score_at_entry'],
                        'win': True
                    })
            elif score <= exit_thresh and position['tp1_taken']:
                exit_reason = 'Signal Exit (after TP1)'
            elif score <= (exit_thresh - 0.5) and not position['tp1_taken']:
                exit_reason = 'Signal Exit (strong reversal)'
            elif time_stop and (date - position['entry_date']).days >= time_stop:
                exit_reason = f'Time Stop ({time_stop}d)'

            if exit_reason and position['shares'] > 0:
                pnl = (exit_price - position['entry_price']) * position['shares']
                pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
                capital += position['cost_basis'] + pnl
                trades.append({
                    'entry_date': position['entry_date'].strftime('%Y-%m-%d'),
                    'exit_date': date.strftime('%Y-%m-%d'),
                    'entry_price': round(position['entry_price'], 2),
                    'exit_price': round(exit_price, 2),
                    'shares': position['shares'],
                    'pnl': round(pnl, 2),
                    'pnl_pct': round(pnl_pct, 2),
                    'exit_reason': exit_reason,
                    'duration_days': (date - position['entry_date']).days,
                    'score_at_entry': position['score_at_entry'],
                    'win': pnl > 0
                })
                # Cooldown after stop loss — wait 5 bars before re-entering
                if exit_reason == 'Stop Loss':
                    cooldown_days = 5
                position = None

        elif score >= entry_thresh and cooldown_days == 0:
            # Entry filters
            if trend_filter and not row['bull_regime']:
                continue
            if momentum_filter and not (row['macd_hist'] > 0 or row['rsi_bounce'] or row['macd_cross']):
                continue
            # Market regime filter — require SPY above short-term trend (not in bear market)
            spy_price = row.get('spy_price', None)
            spy_ma50  = row.get('spy_ma50',  None)
            if spy_price is not None and spy_ma50 is not None:
                if float(spy_price) < float(spy_ma50):
                    continue  # SPY below MA50 — avoid trading in downtrends

            # Risk/Reward filter — use TP2 vs stop (wide-stop strategy exits 40% at TP1,
            # core position targets TP2; measuring R:R at TP1 always fails with wide stops)
            sl_price  = price - sl_atr * atr
            tp2_price = price + tp2_atr * atr
            potential_reward = tp2_price - price   # reward = distance to TP2
            potential_risk   = price - sl_price    # risk   = distance to stop
            if potential_risk > 0 and potential_reward / potential_risk < 0.5:
                continue  # Only skip truly unacceptable setups

            # Dynamic position sizing: scale with conviction above entry threshold
            max_score = 10.0
            conviction = (score - entry_thresh) / max(max_score - entry_thresh, 1.0)
            dynamic_pct = pos_size * (0.5 + conviction * 0.5)  # 50%-100% of max size
            shares = int(capital * dynamic_pct / price)
            if shares > 0:
                cost = shares * price
                capital -= cost
                position = {
                    'entry_price': price,
                    'entry_date': date,
                    'shares': shares,
                    'cost_basis': cost,
                    'stop_loss': round(price - sl_atr * atr, 2),
                    'take_profit_1': round(price + tp1_atr * atr, 2),
                    'take_profit_2': round(price + tp2_atr * atr, 2),
                    'score_at_entry': round(score, 1),
                    'tp1_taken': False
                }

    # Close open position
    if position and position['shares'] > 0:
        last_price = float(df['Close'].iloc[-1])
        pnl = (last_price - position['entry_price']) * position['shares']
        pnl_pct = (last_price - position['entry_price']) / position['entry_price'] * 100
        capital += position['cost_basis'] + pnl
        trades.append({
            'entry_date': position['entry_date'].strftime('%Y-%m-%d'),
            'exit_date': df.index[-1].strftime('%Y-%m-%d'),
            'entry_price': round(position['entry_price'], 2),
            'exit_price': round(last_price, 2),
            'shares': position['shares'],
            'pnl': round(pnl, 2),
            'pnl_pct': round(pnl_pct, 2),
            'exit_reason': 'End of Backtest',
            'duration_days': (df.index[-1] - position['entry_date']).days,
            'score_at_entry': position['score_at_entry'],
            'win': pnl > 0
        })

    final_capital = capital
    total_return = (final_capital - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100

    wins = [t for t in trades if t['win']]
    losses = [t for t in trades if not t['win']]
    win_rate = len(wins) / len(trades) * 100 if trades else 0
    avg_win = float(np.mean([t['pnl_pct'] for t in wins])) if wins else 0
    avg_loss = float(np.mean([t['pnl_pct'] for t in losses])) if losses else 0
    gross_win = sum(t['pnl'] for t in wins)
    gross_loss = abs(sum(t['pnl'] for t in losses))
    profit_factor = gross_win / gross_loss if gross_loss > 0 else 99.0

    eq_vals = [e['portfolio_value'] for e in equity_curve]
    peak = INITIAL_CAPITAL
    max_dd = 0.0
    for v in eq_vals:
        if v > peak: peak = v
        dd = (peak - v) / peak * 100
        if dd > max_dd: max_dd = dd

    daily_returns = pd.Series(eq_vals).pct_change().dropna()
    rf_daily = 0.045 / 252
    excess = daily_returns - rf_daily
    sharpe = float(excess.mean() / excess.std() * np.sqrt(252)) if excess.std() > 0 else 0

    bh_end = float(df['Close'].iloc[-1])
    bh_return = (bh_shares * bh_end + bh_start_cash - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100

    return {
        'total_return': round(total_return, 2),
        'sharpe': round(sharpe, 3),
        'max_dd': round(max_dd, 2),
        'win_rate': round(win_rate, 1),
        'profit_factor': round(profit_factor, 2),
        'total_trades': len(trades),
        'avg_win': round(avg_win, 2),
        'avg_loss': round(avg_loss, 2),
        'avg_duration': round(float(np.mean([t['duration_days'] for t in trades])), 1) if trades else 0,
        'bh_return': round(bh_return, 2),
        'alpha': round(total_return - bh_return, 2),
        'final_capital': round(final_capital, 2),
        'trades': trades,
        'equity_curve': equity_curve,
        'wins': len(wins),
        'losses': len(losses),
        'best_trade': max(trades, key=lambda x: x['pnl_pct']) if trades else None,
        'worst_trade': min(trades, key=lambda x: x['pnl_pct']) if trades else None,
    }

def run_optimization(df, configs=None):
    """Grid search over parameter combinations. Pass configs to skip grid search."""
    print("\nRunning parameter optimization...")
    if configs is None:
        configs = []
        for sl, tp1, tp2, entry, exit_, time_s, pos in product(
            [3.0, 4.0, 5.0],             # stop loss — balance protection vs noise
            [1.5, 2.0, 2.5],             # TP1 — partial exit to lock in gains
            [3.5, 4.5, 5.5],             # TP2 — let core position run
            [6.5, 7.0, 7.5],             # entry threshold — good setups without over-filtering
            [3.5, 4.0],                  # exit threshold
            [None],                       # no time stop — let winners run
            [0.08, 0.10, 0.12],          # position sizing — enough to matter
        ):
            if tp2 <= tp1: continue
            configs.append({
                'stop_loss_atr': sl, 'tp1_atr': tp1, 'tp2_atr': tp2,
                'entry_threshold': entry, 'exit_threshold': exit_,
                'time_stop_days': time_s, 'position_size_pct': pos,
                'use_trailing_stop': True, 'trend_filter': True, 'momentum_filter': True
            })

    print(f"Testing {len(configs)} configurations...")
    results = []
    for i, cfg in enumerate(configs):
        try:
            r = run_single_backtest(df, cfg)
            r['config'] = cfg
            results.append(r)
        except Exception:
            pass
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(configs)} done...")

    # Sort: configs with trades first, then by total return
    # (zero-trade configs have Sharpe=0 which incorrectly outranks negative-Sharpe configs)
    results.sort(key=lambda x: (x['total_trades'] > 0, x['total_return']), reverse=True)
    return results

def format_result_row(r, rank):
    cfg = r['config']
    return (f"#{rank:2d} | Return:{r['total_return']:+6.1f}% | Alpha:{r['alpha']:+6.1f}% | "
            f"Sharpe:{r['sharpe']:5.2f} | DD:{r['max_dd']:4.1f}% | WR:{r['win_rate']:4.1f}% | "
            f"Trades:{r['total_trades']:3d} | "
            f"SL:{cfg['stop_loss_atr']}x TP1:{cfg['tp1_atr']}x TP2:{cfg['tp2_atr']}x "
            f"Entry:{cfg['entry_threshold']} Time:{cfg['time_stop_days']} Pos:{cfg['position_size_pct']*100:.0f}%")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", type=str, default=None)
    parser.add_argument("--no-optimize", action="store_true", help="Skip grid search, use best known config")
    args = parser.parse_args()
    if args.ticker:
        TICKER = args.ticker.upper()

    print('='*70)
    print(f'Backtest Optimization Engine — {TICKER}')
    print('='*70)

    yf_ticker = yf.Ticker(TICKER)
    hist = yf_ticker.history(period="5y")
    hist.index = hist.index.tz_localize(None)
    print(f"Data: {len(hist)} days ({hist.index[0].date()} to {hist.index[-1].date()})")

    # Fetch SPY for market regime filter
    spy_hist = yf.Ticker("SPY").history(period="5y")
    spy_hist.index = spy_hist.index.tz_localize(None)

    df = prepare_data(hist, spy_hist)
    bh_start = float(df['Close'].iloc[0])
    bh_end = float(df['Close'].iloc[-1])
    bh_return = (bh_end - bh_start) / bh_start * 100
    print(f"Buy & Hold return: {bh_return:.1f}%")

    # Optimization (skip if --no-optimize flag set)
    if args.no_optimize:
        print("Skipping grid search — using default config for quick backtest")
        default_cfg = {
            'stop_loss_atr': 3.5, 'tp1_atr': 2.0, 'tp2_atr': 4.5,
            'entry_threshold': 7.0, 'exit_threshold': 3.5,
            'time_stop_days': None, 'position_size_pct': 0.10,
            'use_trailing_stop': True, 'trend_filter': True, 'momentum_filter': True
        }
        results = run_optimization(df, configs=[default_cfg])
    else:
        results = run_optimization(df)

    print(f"\nTop 10 configurations by Sharpe ratio:")
    print('-'*120)
    for i, r in enumerate(results[:10]):
        print(format_result_row(r, i+1))
    print('-'*120)

    # Best config
    best = results[0]
    best_cfg = best['config']
    print(f"\nBest configuration:")
    print(f"  Stop Loss ATR:      {best_cfg['stop_loss_atr']}x")
    print(f"  Take Profit 1 ATR:  {best_cfg['tp1_atr']}x")
    print(f"  Take Profit 2 ATR:  {best_cfg['tp2_atr']}x")
    print(f"  Entry threshold:    {best_cfg['entry_threshold']}")
    print(f"  Exit threshold:     {best_cfg['exit_threshold']}")
    print(f"  Time stop:          {best_cfg['time_stop_days']} days")
    print(f"  Position size:      {best_cfg['position_size_pct']*100:.0f}%")
    print(f"  Trailing stop:      {best_cfg['use_trailing_stop']}")

    # Exit reason breakdown
    exit_reasons = {}
    for t in best['trades']:
        exit_reasons[t['exit_reason']] = exit_reasons.get(t['exit_reason'], 0) + 1

    # Signal distribution
    buy_days = int((df.apply(lambda r: compute_base_score(r) >= best_cfg['entry_threshold'], axis=1)).sum())
    sell_days = int((df.apply(lambda r: compute_base_score(r) <= best_cfg['exit_threshold'], axis=1)).sum())
    hold_days = len(df) - buy_days - sell_days

    now = datetime.now(timezone.utc).isoformat()
    # Save to data/backtest.json
    output = {
        "ticker": TICKER,
        "generated_at": now,
        "optimization": {
            "configs_tested": len(results),
            "top_10": [
                {
                    "rank": i+1,
                    "total_return_pct": r['total_return'],
                    "alpha_pct": r['alpha'],
                    "sharpe_ratio": r['sharpe'],
                    "max_drawdown_pct": r['max_dd'],
                    "win_rate_pct": r['win_rate'],
                    "total_trades": r['total_trades'],
                    "config": r['config']
                }
                for i, r in enumerate(results[:10])
            ]
        },
        "backtest_period": {
            "years": 2,
            "start_date": df.index[0].strftime('%Y-%m-%d'),
            "end_date": df.index[-1].strftime('%Y-%m-%d'),
            "trading_days": len(df)
        },
        "config": {
            "initial_capital": INITIAL_CAPITAL,
            "position_size_pct": best_cfg['position_size_pct'],
            "commission": 0.0,
            "entry_signal_threshold": best_cfg['entry_threshold'],
            "exit_signal_threshold": best_cfg['exit_threshold'],
            "stop_loss_atr_multiplier": best_cfg['stop_loss_atr'],
            "take_profit_atr_multiplier": best_cfg['tp2_atr'],
            "tp1_atr_multiplier": best_cfg['tp1_atr'],
            "tp2_atr_multiplier": best_cfg['tp2_atr'],
            "time_stop_days": best_cfg['time_stop_days'],
            "use_trailing_stop": best_cfg['use_trailing_stop'],
            "trend_filter": best_cfg['trend_filter'],
            "momentum_filter": best_cfg['momentum_filter'],
        },
        "performance": {
            "final_capital": best['final_capital'],
            "total_return_pct": best['total_return'],
            "total_pnl": round(best['final_capital'] - INITIAL_CAPITAL, 2),
            "annualized_return_pct": round(best['total_return'] / 2, 2),
            "sharpe_ratio": best['sharpe'],
            "max_drawdown_pct": best['max_dd'],
            "profit_factor": best['profit_factor'],
            "win_rate_pct": best['win_rate'],
            "total_trades": best['total_trades'],
            "winning_trades": best['wins'],
            "losing_trades": best['losses'],
            "avg_win_pct": best['avg_win'],
            "avg_loss_pct": best['avg_loss'],
            "avg_duration_days": best['avg_duration'],
            "best_trade": best['best_trade'],
            "worst_trade": best['worst_trade'],
            "exit_reason_breakdown": exit_reasons
        },
        "benchmark": {
            "name": f"Buy & Hold {TICKER}",
            "return_pct": round(bh_return, 2),
            "final_value": round(int(INITIAL_CAPITAL / bh_start) * bh_end + (INITIAL_CAPITAL - int(INITIAL_CAPITAL / bh_start) * bh_start), 2),
            "start_price": round(bh_start, 2),
            "end_price": round(bh_end, 2),
            "alpha_pct": round(best['total_return'] - bh_return, 2)
        },
        "trades": best['trades'],
        "equity_curve": best['equity_curve'],
        "signal_distribution": {
            "buy": buy_days,
            "hold": hold_days,
            "sell": sell_days
        }
    }

    path = os.path.join(DATA_DIR, "backtest.json")
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n[OK] Saved to {path}")

    print(f"\n{'='*70}")
    print(f"BEST RESULT: Return {best['total_return']:+.1f}% | Alpha {best['alpha']:+.1f}% vs B&H | Sharpe {best['sharpe']:.2f} | DD -{best['max_dd']:.1f}%")
    is_profitable = best['total_return'] > 0
    beats_bh = best['alpha'] > 0
    print(f"VERDICT: {'PROFITABLE' if is_profitable else 'UNPROFITABLE'} | {'BEATS' if beats_bh else 'LAGS'} BUY & HOLD by {abs(best['alpha']):.1f}%")
    print('='*70)

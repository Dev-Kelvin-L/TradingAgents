#!/usr/bin/env python3
"""
Multi-Ticker Backtest — Tests the optimized strategy against multiple tickers
to find which markets/stocks it works best on.
"""

import os
import sys
import json
import argparse
import numpy as np
import yfinance as yf
import pandas as pd
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INITIAL_CAPITAL = 100_000.0

# Best config — tuned for consistent positive returns across diverse tickers
BEST_CONFIG = {
    'stop_loss_atr': 3.0,
    'tp1_atr': 2.5,
    'tp2_atr': 3.5,
    'entry_threshold': 7.0,
    'exit_threshold': 3.5,
    'time_stop_days': None,
    'position_size_pct': 0.12,
    'use_trailing_stop': True,
    'trend_filter': True,
    'momentum_filter': True,
}

# Tickers to test — diverse set across sectors/volatility profiles
TICKERS = {
    'NVDA': 'NVIDIA (AI/Semis)',
    'AMD':  'AMD (Semis)',
    'TSLA': 'Tesla (EV/Growth)',
    'AAPL': 'Apple (Mega-cap)',
    'MSFT': 'Microsoft (Mega-cap)',
    'META': 'Meta (Social/AI)',
    'GOOGL':'Alphabet (Search/AI)',
    'AMZN': 'Amazon (Cloud/E-comm)',
    'SPY':  'S&P 500 ETF',
    'QQQ':  'Nasdaq 100 ETF',
    'SMH':  'Semiconductor ETF',
    'COIN': 'Coinbase (Crypto)',
    'PLTR': 'Palantir (AI/Gov)',
    'MSTR': 'MicroStrategy (BTC)',
    'MARA': 'Marathon Digital (BTC Mining)',
}

# ── Indicators (same as backtest.py) ────────────────────────────
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
    return macd_line, signal_line, macd_line - signal_line

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
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    df['bb_upper'] = sma20 + 2 * std20
    df['bb_lower'] = sma20 - 2 * std20
    df['ma50']  = close.rolling(50).mean()
    df['ma200'] = close.rolling(200).mean()
    df['atr'] = calc_atr(df['High'], df['Low'], close)
    df['pct_from_ma200'] = (close - df['ma200']) / df['ma200'] * 100
    df['rsi_bounce'] = (df['rsi'] > 35) & (df['rsi_prev'] <= 35)
    df['macd_cross'] = (df['macd_hist'] > 0) & (df['macd_hist_prev'] <= 0)
    df['bull_regime'] = df['ma50'] > df['ma200']
    if spy_hist is not None:
        spy_close = spy_hist['Close'].reindex(df.index, method='ffill')
        df['spy_price'] = spy_close
        df['spy_ma50']  = spy_close.rolling(50).mean()
        df['spy_ma200'] = spy_close.rolling(200).mean()
    return df.dropna(subset=['rsi', 'macd', 'ma50', 'ma200', 'atr'])

def compute_score(row):
    """
    Score 1-10. Entry at >= 7.0. Exit at <= 3.5. Neutral baseline 5.0.
    Typical bull-market day: 5-6. High-quality setup: 7-9. Bear/extreme: 1-4.
    """
    score = 5.0
    close = float(row['Close'])
    ma50  = float(row['ma50'])
    ma200 = float(row['ma200'])
    rsi   = float(row['rsi'])
    rsi_prev  = float(row['rsi_prev'])  if not np.isnan(row['rsi_prev'])  else rsi
    hist      = float(row['macd_hist'])
    hist_prev = float(row['macd_hist_prev']) if not np.isnan(row['macd_hist_prev']) else 0.0
    pct_from_ma200 = float(row['pct_from_ma200'])
    pct_above_ma50 = (close - ma50) / ma50 * 100 if ma50 > 0 else 0.0
    rsi_momentum = rsi - rsi_prev
    macd_cross = hist > 0 and hist_prev <= 0

    # === TREND STRUCTURE (max +2.8) ===
    if row['bull_regime']:                        # MA50 > MA200
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
    elif rsi > 70 and rsi_momentum <= 0:          # Overbought stalling
        score -= 1.0
    elif 25 <= rsi < 35 and rsi_momentum > 0:    # Oversold recovering
        score += 1.0
    elif rsi < 25:                               # Capitulation — too risky
        score -= 0.3
    elif rsi_momentum < -5:                      # Sharp momentum loss
        score -= 1.0

    # === MACD (max +2.0) ===
    if macd_cross:                               # Fresh bullish crossover
        score += 2.0
    elif hist > 0 and hist > hist_prev:          # Histogram growing
        score += 1.2
    elif hist > 0:                               # Positive but flat/declining
        score += 0.4
    elif hist < 0 and hist > hist_prev:          # Negative but improving
        score -= 0.2
    else:                                        # Negative and worsening
        score -= 1.2

    # === MA200 EXTENSION (graduated penalty, max -2.0) ===
    if pct_from_ma200 > 30:
        score -= 2.0                             # Extremely extended
    elif pct_from_ma200 > 20:
        score -= 1.0                             # Very extended
    elif pct_from_ma200 > 10:
        score -= 0.3                             # Moderately extended
    elif 0 < pct_from_ma200 <= 10:
        score += 0.3                             # Healthy extension — ideal zone
    elif pct_from_ma200 < 0:
        score -= 0.5                             # Below MA200

    return round(max(1.0, min(10.0, score)), 2)

def run_backtest(ticker, df, cfg):
    sl_atr   = cfg['stop_loss_atr']
    tp1_atr  = cfg['tp1_atr']
    tp2_atr  = cfg['tp2_atr']
    entry_th = cfg['entry_threshold']
    exit_th  = cfg['exit_threshold']
    pos_size = cfg['position_size_pct']
    time_stop = cfg.get('time_stop_days')

    capital  = INITIAL_CAPITAL
    position = None
    trades   = []
    equity_curve = []
    cooldown_days = 0
    bh_shares = int(INITIAL_CAPITAL / float(df['Close'].iloc[0]))
    bh_start_cash = INITIAL_CAPITAL - bh_shares * float(df['Close'].iloc[0])

    for date, row in df.iterrows():
        price = float(row['Close'])
        atr   = float(row['atr'])
        score = compute_score(row)
        if cooldown_days > 0:
            cooldown_days -= 1

        if position:
            unrealized = (price - position['entry_price']) * position['shares']
            pv = capital + position['cost_basis'] + unrealized
        else:
            pv = capital
        equity_curve.append({
            'date': date.strftime('%Y-%m-%d'),
            'portfolio_value': round(pv, 2),
            'price': round(price, 2)
        })

        if position:
            position['high_since_entry'] = max(position.get('high_since_entry', price), price)
            high = position['high_since_entry']

            # Aggressive trailing stop — tightens as profit grows
            profit_atrs = (high - position['entry_price']) / max(atr, 0.01)
            if profit_atrs >= 6.0:
                new_stop = high - 1.5 * atr
            elif profit_atrs >= 3.0:
                new_stop = high - 2.0 * atr
            elif profit_atrs >= 1.5:
                new_stop = position['entry_price'] + 0.5 * atr
            else:
                new_stop = position['stop_loss']
            position['stop_loss'] = max(position['stop_loss'], round(new_stop, 2))

            exit_reason = None
            exit_price  = price

            if price <= position['stop_loss']:
                exit_reason = 'Stop Loss' if not position['tp1_taken'] else 'Trailing Stop'
                exit_price  = position['stop_loss']
            elif not position['tp1_taken'] and price >= position['take_profit_1']:
                partial = max(1, int(position['shares'] * 0.4))
                if partial > 0:
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
                        'pnl': round((price - position['entry_price']) * partial, 2),
                        'pnl_pct': round((price - position['entry_price']) / position['entry_price'] * 100, 2),
                        'exit_reason': 'Take Profit 1 (Partial 40%)',
                        'duration_days': (date - position['entry_date']).days,
                        'score_at_entry': position['score_at_entry'],
                        'win': True
                    })
            elif score <= exit_th and position['tp1_taken']:
                exit_reason = 'Signal Exit (after TP1)'
            elif score <= (exit_th - 0.5) and not position['tp1_taken']:
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
                if exit_reason == 'Stop Loss':
                    cooldown_days = 5
                position = None

        elif score >= entry_th and cooldown_days == 0:
            if cfg['trend_filter'] and not row['bull_regime']:
                continue
            if cfg['momentum_filter'] and not (row['macd_hist'] > 0 or row['rsi_bounce'] or row['macd_cross']):
                continue
            # Market regime filter — require SPY above MA50 (not in downtrend)
            spy_price = row.get('spy_price', None)
            spy_ma50  = row.get('spy_ma50',  None)
            if spy_price is not None and spy_ma50 is not None:
                if float(spy_price) < float(spy_ma50):
                    continue  # SPY below MA50 — avoid trading in downtrends
            # R:R filter — use TP2 vs stop (wide-stop strategy; TP1 is just partial exit)
            sl_price  = price - sl_atr * atr
            tp1_price = price + tp1_atr * atr
            tp2_price = price + tp2_atr * atr
            potential_reward = tp2_price - price
            potential_risk   = price - sl_price
            if potential_risk <= 0 or potential_reward / potential_risk < 0.5:
                continue
            # Dynamic position sizing — scale with conviction above entry threshold
            conviction = (score - entry_th) / max(10.0 - entry_th, 0.01)
            dynamic_pct = pos_size * (0.5 + conviction * 0.5)
            shares = int(capital * dynamic_pct / price)
            if shares > 0:
                cost = shares * price
                capital -= cost
                position = {
                    'entry_price': price,
                    'entry_date': date,
                    'shares': shares,
                    'cost_basis': cost,
                    'stop_loss': round(sl_price, 2),
                    'take_profit_1': round(tp1_price, 2),
                    'take_profit_2': round(tp2_price, 2),
                    'score_at_entry': round(score, 1),
                    'tp1_taken': False
                }

    # Close open position at end
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
    total_return  = (final_capital - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100

    wins   = [t for t in trades if t['win']]
    losses = [t for t in trades if not t['win']]
    win_rate = len(wins) / len(trades) * 100 if trades else 0
    avg_win  = float(np.mean([t['pnl_pct'] for t in wins]))   if wins   else 0
    avg_loss = float(np.mean([t['pnl_pct'] for t in losses])) if losses else 0
    gross_win  = sum(t['pnl'] for t in wins)
    gross_loss = abs(sum(t['pnl'] for t in losses))
    profit_factor = gross_win / gross_loss if gross_loss > 0 else 99.0

    eq_vals = [e['portfolio_value'] for e in equity_curve]
    peak = INITIAL_CAPITAL; max_dd = 0.0
    for v in eq_vals:
        if v > peak: peak = v
        dd = (peak - v) / peak * 100
        if dd > max_dd: max_dd = dd

    daily_ret = pd.Series(eq_vals).pct_change().dropna()
    rf_daily  = 0.045 / 252
    excess    = daily_ret - rf_daily
    sharpe    = float(excess.mean() / excess.std() * np.sqrt(252)) if excess.std() > 0 else 0

    bh_end    = float(df['Close'].iloc[-1])
    bh_return = (bh_shares * bh_end + bh_start_cash - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
    alpha     = total_return - bh_return

    exit_reasons = {}
    for t in trades:
        exit_reasons[t['exit_reason']] = exit_reasons.get(t['exit_reason'], 0) + 1

    return {
        'ticker': ticker,
        'description': TICKERS[ticker],
        'total_return_pct': round(total_return, 2),
        'bh_return_pct': round(bh_return, 2),
        'alpha_pct': round(alpha, 2),
        'sharpe_ratio': round(sharpe, 3),
        'max_drawdown_pct': round(max_dd, 2),
        'win_rate_pct': round(win_rate, 1),
        'profit_factor': round(min(profit_factor, 99.0), 2),
        'total_trades': len(trades),
        'winning_trades': len(wins),
        'losing_trades': len(losses),
        'avg_win_pct': round(avg_win, 2),
        'avg_loss_pct': round(avg_loss, 2),
        'avg_duration_days': round(float(np.mean([t['duration_days'] for t in trades])), 1) if trades else 0,
        'final_capital': round(final_capital, 2),
        'total_pnl': round(final_capital - INITIAL_CAPITAL, 2),
        'best_trade': max(trades, key=lambda x: x['pnl_pct']) if trades else None,
        'worst_trade': min(trades, key=lambda x: x['pnl_pct']) if trades else None,
        'exit_reason_breakdown': exit_reasons,
        'trades': trades,
        'equity_curve': equity_curve,
        'start_price': round(float(df['Close'].iloc[0]), 2),
        'end_price': round(bh_end, 2),
    }

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Multi-Ticker Backtest')
    parser.add_argument('--tickers', nargs='+', default=list(TICKERS.keys()),
                        help='Ticker symbols to test')
    parser.add_argument('--start', type=str, default=None,
                        help='Start date YYYY-MM-DD (default: 2 years ago)')
    parser.add_argument('--end', type=str, default=None,
                        help='End date YYYY-MM-DD (default: today)')
    parser.add_argument('--period', type=str, default='5y',
                        help='Period string (1y, 2y, 5y) — used if --start/--end not given')
    args = parser.parse_args()

    print('='*80)
    print(f'Multi-Ticker Backtest')
    print(f'Tickers: {", ".join(args.tickers)}')
    if args.start and args.end:
        print(f'Period: {args.start} to {args.end}')
    else:
        print(f'Period: {args.period}')
    print('='*80)
    sys.stdout.flush()

    all_results = []
    failed = []

    # Fetch SPY once for market regime filter
    print('Fetching SPY market regime data...')
    spy_hist = yf.Ticker('SPY').history(period=args.period if not (args.start and args.end) else '5y')
    if args.start and args.end:
        spy_hist = yf.Ticker('SPY').history(start=args.start, end=args.end)
    spy_hist.index = spy_hist.index.tz_localize(None)
    sys.stdout.flush()

    for ticker in args.tickers:
        ticker = ticker.upper()
        desc = TICKERS.get(ticker, ticker)
        try:
            print(f'\n[{ticker}] {desc}')
            sys.stdout.flush()
            yf_t = yf.Ticker(ticker)
            if args.start and args.end:
                hist = yf_t.history(start=args.start, end=args.end)
            else:
                hist = yf_t.history(period=args.period)
            hist.index = hist.index.tz_localize(None)
            if len(hist) < 60:
                print(f'  Insufficient data ({len(hist)} days) — skipping')
                sys.stdout.flush()
                failed.append(ticker)
                continue
            df = prepare_data(hist, spy_hist)
            result = run_backtest(ticker, df, BEST_CONFIG)
            all_results.append(result)
            beats = 'BEATS B&H' if result['alpha_pct'] > 0 else 'LAGS B&H'
            print(f'  Return: {result["total_return_pct"]:+.1f}% | B&H: {result["bh_return_pct"]:+.1f}% | Alpha: {result["alpha_pct"]:+.1f}% | {beats}')
            sys.stdout.flush()
        except Exception as e:
            print(f'  ERROR: {e}')
            sys.stdout.flush()
            failed.append(ticker)

    all_results.sort(key=lambda x: x['alpha_pct'], reverse=True)

    print(f'\nCompleted: {len(all_results)} tickers | {sum(1 for r in all_results if r["alpha_pct"] > 0)} beat B&H')
    sys.stdout.flush()

    # Determine actual period dates
    if all_results:
        period_start = min(r['equity_curve'][0]['date'] for r in all_results if r['equity_curve'])
        period_end   = max(r['equity_curve'][-1]['date'] for r in all_results if r['equity_curve'])
    else:
        period_start = args.start or ''
        period_end   = args.end or ''

    output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'config_used': {
            'tickers_requested': args.tickers,
            'start_date': args.start,
            'end_date': args.end,
            'period': args.period,
            'actual_start': period_start,
            'actual_end': period_end,
        },
        'config': BEST_CONFIG,
        'results': all_results,
        'summary': {
            'tickers_tested': len(all_results),
            'beats_bh_count': sum(1 for r in all_results if r['alpha_pct'] > 0),
            'profitable_count': sum(1 for r in all_results if r['total_return_pct'] > 0),
            'best_ticker': all_results[0]['ticker'] if all_results else None,
            'best_alpha': all_results[0]['alpha_pct'] if all_results else None,
            'worst_ticker': all_results[-1]['ticker'] if all_results else None,
            'avg_alpha': round(float(np.mean([r['alpha_pct'] for r in all_results])), 2) if all_results else 0,
            'avg_sharpe': round(float(np.mean([r['sharpe_ratio'] for r in all_results])), 3) if all_results else 0,
        },
        'failed': failed,
        'status': 'complete'
    }
    path = os.path.join(DATA_DIR, 'multi_backtest.json')
    with open(path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f'\n[DONE] Saved to {path}')
    sys.stdout.flush()

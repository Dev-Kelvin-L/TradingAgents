'use client'

import { useState, useCallback, useEffect } from 'react'
import BacktestControls from '@/components/BacktestControls'
import type { MultiBacktestResult, MultiBacktestData } from '@/types/trading'

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals)
}

function fmtSign(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

function VerdictBadge({ alpha }: { alpha: number }) {
  if (alpha > 0) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#003322] text-[#00ff88] border border-[#00ff88]/30">
        BEATS B&H
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#330000] text-[#ff4444] border border-[#ff4444]/30">
      LAGS B&H
    </span>
  )
}

function ExitReasonBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const colors: Record<string, string> = {
    'Stop Loss': '#ff4444',
    'Take Profit 1 (Partial 50%)': '#00ff88',
    'Take Profit 2 (Full)': '#00cc66',
    'Signal Reversal': '#ffaa00',
    'End of Backtest': '#666',
  }

  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-1.5 mt-2">
      {entries.map(([reason, count]) => {
        const pct = (count / total) * 100
        const color = colors[reason] || '#888'
        return (
          <div key={reason}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-400">{reason}</span>
              <span className="text-gray-300 font-mono">{count} ({fmt(pct, 0)}%)</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function TickerCard({ result, rank }: { result: MultiBacktestResult; rank: number }) {
  const beats = result.alpha_pct > 0
  const borderColor = beats ? 'border-[#00ff88]/20' : 'border-[#ff4444]/20'
  const bgGlow = beats ? 'bg-[#001a0e]' : 'bg-[#1a0000]'

  return (
    <div className={`border ${borderColor} ${bgGlow} rounded-lg p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-gray-500">#{rank}</span>
            <span className="font-mono text-xl font-bold text-white">{result.ticker}</span>
            <VerdictBadge alpha={result.alpha_pct} />
          </div>
          <div className="text-xs text-gray-500 mt-1">{result.description}</div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-2xl font-bold ${result.alpha_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
            {fmtSign(result.alpha_pct)} alpha
          </div>
          <div className="text-xs text-gray-500">vs buy &amp; hold</div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <MetricCard
          label="Strategy Return"
          value={fmtSign(result.total_return_pct)}
          color={result.total_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}
        />
        <MetricCard
          label="Buy & Hold"
          value={fmtSign(result.bh_return_pct)}
          color={result.bh_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={fmt(result.sharpe_ratio, 2)}
          color={result.sharpe_ratio >= 1 ? 'text-[#00ff88]' : result.sharpe_ratio >= 0 ? 'text-yellow-400' : 'text-[#ff4444]'}
        />
        <MetricCard
          label="Max Drawdown"
          value={`-${fmt(result.max_drawdown_pct)}%`}
          color={result.max_drawdown_pct < 10 ? 'text-[#00ff88]' : 'text-[#ff4444]'}
        />
        <MetricCard
          label="Win Rate"
          value={`${fmt(result.win_rate_pct, 0)}%`}
          sub={`${result.winning_trades}W / ${result.losing_trades}L`}
          color={result.win_rate_pct >= 50 ? 'text-[#00ff88]' : 'text-yellow-400'}
        />
        <MetricCard
          label="Profit Factor"
          value={result.profit_factor >= 99 ? '99+' : fmt(result.profit_factor, 2)}
          color={result.profit_factor >= 1.5 ? 'text-[#00ff88]' : result.profit_factor >= 1 ? 'text-yellow-400' : 'text-[#ff4444]'}
        />
      </div>

      {/* Best / Worst trade */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {result.best_trade && (
          <div className="bg-[#0a1a10] border border-[#00ff88]/10 rounded p-3">
            <div className="text-xs text-[#00ff88] font-semibold mb-1">Best Trade</div>
            <div className="font-mono text-sm font-bold text-[#00ff88]">+{fmt(result.best_trade.pnl_pct)}%</div>
            <div className="text-xs text-gray-500">{result.best_trade.entry_date} → {result.best_trade.exit_date}</div>
            <div className="text-xs text-gray-600">{result.best_trade.exit_reason}</div>
          </div>
        )}
        {result.worst_trade && (
          <div className="bg-[#1a0a0a] border border-[#ff4444]/10 rounded p-3">
            <div className="text-xs text-[#ff4444] font-semibold mb-1">Worst Trade</div>
            <div className="font-mono text-sm font-bold text-[#ff4444]">{fmt(result.worst_trade.pnl_pct)}%</div>
            <div className="text-xs text-gray-500">{result.worst_trade.entry_date} → {result.worst_trade.exit_date}</div>
            <div className="text-xs text-gray-600">{result.worst_trade.exit_reason}</div>
          </div>
        )}
      </div>

      {/* Exit reason breakdown */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Exit Reason Breakdown ({result.total_trades} total trades)</div>
        <ExitReasonBar breakdown={result.exit_reason_breakdown} />
      </div>
    </div>
  )
}

function deriveInsight(results: MultiBacktestResult[]): string {
  const beats = results.filter(r => r.alpha_pct > 0)
  const lags = results.filter(r => r.alpha_pct <= 0)

  const cryptoWinners = beats.filter(r => ['MSTR', 'MARA', 'COIN'].includes(r.ticker))
  const trendingLosers = lags.filter(r => ['PLTR', 'AMD', 'SMH', 'GOOGL', 'NVDA'].includes(r.ticker))

  const parts: string[] = []

  if (cryptoWinners.length >= 2) {
    parts.push(
      `The strategy generates positive alpha on crypto-correlated and high-volatility names (${cryptoWinners.map(r => r.ticker).join(', ')}) where buy-and-hold suffered large drawdowns — the trend filter and stop-loss kept the strategy flat while B&H collapsed.`
    )
  }

  if (trendingLosers.length >= 2) {
    parts.push(
      `It underperforms significantly on strong secular uptrend stocks (${trendingLosers.map(r => r.ticker).join(', ')}) — the signal score threshold is too cautious; the strategy sits in cash and misses large directional moves.`
    )
  }

  parts.push(
    `The alpha comes primarily from capital preservation, not from superior entry/exit timing: on losing B&H markets the strategy avoids deep drawdowns, while on winning B&H markets it misses the bulk of the move.`
  )

  parts.push(
    `Best use case: deploy this strategy on volatile, mean-reverting, or range-bound assets (crypto-linked equities, turnaround stories). Avoid using it as a primary system on high-conviction secular growth names — a simple buy-and-hold or momentum approach will outperform there.`
  )

  return parts.join(' ')
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-[#00ff88]/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-[#00ff88] animate-spin" />
      </div>
      <div className="text-xs font-mono text-gray-500">Backtest running — fetching data &amp; computing signals...</div>
    </div>
  )
}

export default function MultiBacktestPage() {
  const [data, setData] = useState<MultiBacktestData | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/backtest-status')
      if (!res.ok) return
      const json = await res.json()
      setStatus(json.status || 'complete')
      if (json.status === 'complete' || json.status === 'error') {
        // Fetch full data
        const fullRes = await fetch('/api/backtest-status')
        const fullJson = await fullRes.json()
        // Reconstruct a MultiBacktestData-compatible object from status endpoint
        setData({
          generated_at: new Date().toISOString(),
          status: fullJson.status,
          config: {
            stop_loss_atr: 3.5,
            tp1_atr: 3.5,
            tp2_atr: 5.0,
            entry_threshold: 6.0,
            exit_threshold: 3.5,
            time_stop_days: null,
            position_size_pct: 0.10,
            use_trailing_stop: true,
            trend_filter: true,
            momentum_filter: true,
          },
          results: fullJson.results || [],
          summary: fullJson.summary || {
            tickers_tested: 0,
            beats_bh_count: 0,
            profitable_count: 0,
            best_ticker: null,
            best_alpha: null,
            worst_ticker: null,
            avg_alpha: 0,
            avg_sharpe: 0,
          },
        })
        setLastRun(new Date().toLocaleTimeString())
        setLoadError(null)
      }
    } catch {
      setLoadError('Could not load backtest data.')
    }
  }, [])

  // Load existing data on mount
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await fetch('/api/backtest-status')
        if (!res.ok) return
        const json = await res.json()
        if (json.status === 'complete' && json.results?.length > 0) {
          setStatus('complete')
          setData({
            generated_at: new Date().toISOString(),
            status: 'complete',
            config: {
              stop_loss_atr: 3.5,
              tp1_atr: 3.5,
              tp2_atr: 5.0,
              entry_threshold: 6.0,
              exit_threshold: 3.5,
              time_stop_days: null,
              position_size_pct: 0.10,
              use_trailing_stop: true,
              trend_filter: true,
              momentum_filter: true,
            },
            results: json.results,
            summary: json.summary,
          })
        }
      } catch {}
    }
    loadInitial()
  }, [])

  const results = data?.results ?? []
  const summary = data?.summary ?? {
    tickers_tested: 0,
    beats_bh_count: 0,
    profitable_count: 0,
    best_ticker: null,
    best_alpha: null,
    worst_ticker: null,
    avg_alpha: 0,
    avg_sharpe: 0,
  }

  const top3 = results.slice(0, 3)
  const bottom3 = results.slice(-3).reverse()
  const beatsPct = summary.tickers_tested > 0
    ? Math.round((summary.beats_bh_count / summary.tickers_tested) * 100)
    : 0
  const insight = results.length > 0 ? deriveInsight(results) : null
  const config = data?.config

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Multi-Ticker Strategy Test</h1>
          <p className="text-gray-500 text-sm mt-1">
            Run the optimized strategy across any set of tickers and date ranges
          </p>
        </div>
        {lastRun && (
          <div className="text-xs font-mono text-gray-600 mt-1">
            Last run: {lastRun}
          </div>
        )}
      </div>

      {/* Controls panel */}
      <BacktestControls onComplete={fetchResults} />

      {loadError && (
        <div className="bg-[#1a0000] border border-[#ff4444]/30 rounded p-4 text-sm font-mono text-[#ff4444]">
          {loadError}
        </div>
      )}

      {/* Running spinner */}
      {status === 'running' && <LoadingSpinner />}

      {/* Results */}
      {status !== 'running' && results.length > 0 && (
        <>
          {/* Summary stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0d1a0d] border border-[#00ff88]/20 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Best Alpha</div>
              <div className="font-mono text-xl font-bold text-[#00ff88]">
                {summary.best_ticker} {fmtSign(summary.best_alpha ?? 0)}
              </div>
              <div className="text-xs text-gray-600">vs buy &amp; hold</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Avg Alpha (all)</div>
              <div className={`font-mono text-xl font-bold ${summary.avg_alpha >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                {fmtSign(summary.avg_alpha)}
              </div>
              <div className="text-xs text-gray-600">across all tickers</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Beat B&H Rate</div>
              <div className={`font-mono text-xl font-bold ${beatsPct >= 50 ? 'text-[#00ff88]' : 'text-yellow-400'}`}>
                {summary.beats_bh_count}/{summary.tickers_tested}
              </div>
              <div className="text-xs text-gray-600">{beatsPct}% of tickers</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Avg Sharpe</div>
              <div className={`font-mono text-xl font-bold ${summary.avg_sharpe >= 1 ? 'text-[#00ff88]' : summary.avg_sharpe >= 0 ? 'text-yellow-400' : 'text-[#ff4444]'}`}>
                {fmt(summary.avg_sharpe, 2)}
              </div>
              <div className="text-xs text-gray-600">all tickers</div>
            </div>
          </div>

          {/* Full ranking table */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#1a1a1a]">
              <h2 className="font-mono text-sm font-bold text-white">Full Ranking — Sorted by Alpha</h2>
              <p className="text-xs text-gray-500 mt-0.5">Alpha = Strategy Return minus Buy &amp; Hold Return</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-gray-500">
                    <th className="text-left px-4 py-2.5">Rank</th>
                    <th className="text-left px-4 py-2.5">Ticker</th>
                    <th className="text-left px-4 py-2.5 hidden md:table-cell">Description</th>
                    <th className="text-right px-4 py-2.5">Strategy</th>
                    <th className="text-right px-4 py-2.5">B&H</th>
                    <th className="text-right px-4 py-2.5">Alpha</th>
                    <th className="text-right px-4 py-2.5 hidden lg:table-cell">Sharpe</th>
                    <th className="text-right px-4 py-2.5 hidden lg:table-cell">Max DD</th>
                    <th className="text-right px-4 py-2.5">Win Rate</th>
                    <th className="text-right px-4 py-2.5 hidden md:table-cell">Trades</th>
                    <th className="text-center px-4 py-2.5">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const beats = r.alpha_pct > 0
                    const rowBg = beats ? 'bg-[#001a0e]/40' : 'bg-[#1a0000]/20'
                    return (
                      <tr key={r.ticker} className={`border-b border-[#1a1a1a]/50 hover:bg-[#1a1a1a]/50 transition-colors ${rowBg}`}>
                        <td className="px-4 py-2.5 text-gray-500">#{i + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-white">{r.ticker}</td>
                        <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">{r.description}</td>
                        <td className={`px-4 py-2.5 text-right ${r.total_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                          {fmtSign(r.total_return_pct)}
                        </td>
                        <td className={`px-4 py-2.5 text-right ${r.bh_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                          {fmtSign(r.bh_return_pct)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${r.alpha_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                          {fmtSign(r.alpha_pct)}
                        </td>
                        <td className={`px-4 py-2.5 text-right hidden lg:table-cell ${r.sharpe_ratio >= 1 ? 'text-[#00ff88]' : r.sharpe_ratio >= 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {fmt(r.sharpe_ratio, 2)}
                        </td>
                        <td className={`px-4 py-2.5 text-right hidden lg:table-cell ${r.max_drawdown_pct < 10 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                          -{fmt(r.max_drawdown_pct)}%
                        </td>
                        <td className={`px-4 py-2.5 text-right ${r.win_rate_pct >= 50 ? 'text-[#00ff88]' : 'text-yellow-400'}`}>
                          {fmt(r.win_rate_pct, 0)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">{r.total_trades}</td>
                        <td className="px-4 py-2.5 text-center">
                          <VerdictBadge alpha={r.alpha_pct} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 3 winners */}
          {top3.length > 0 && (
            <div>
              <h2 className="font-mono text-sm font-bold text-[#00ff88] mb-3">Top {top3.length} Alpha Generators</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {top3.map((r, i) => (
                  <TickerCard key={r.ticker} result={r} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom 3 laggards */}
          {bottom3.length > 0 && results.length > 3 && (
            <div>
              <h2 className="font-mono text-sm font-bold text-[#ff4444] mb-3">Bottom {bottom3.length} Laggards</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {bottom3.map((r, i) => (
                  <TickerCard key={r.ticker} result={r} rank={results.length - (bottom3.length - 1 - i)} />
                ))}
              </div>
            </div>
          )}

          {/* Strategy insight box */}
          {insight && (
            <div className="bg-[#0d1020] border border-[#2244aa]/30 rounded-lg p-5">
              <h2 className="font-mono text-sm font-bold text-[#4488ff] mb-3">Strategy Insight</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#111] rounded p-2.5">
                  <div className="text-[#00ff88] font-bold mb-1">Works Best On</div>
                  <div className="text-gray-400">Crypto-correlated (MSTR, MARA, COIN), volatile turnarounds</div>
                </div>
                <div className="bg-[#111] rounded p-2.5">
                  <div className="text-yellow-400 font-bold mb-1">Moderate On</div>
                  <div className="text-gray-400">Mega-cap stocks in sideways markets (META, MSFT, AMZN, TSLA)</div>
                </div>
                <div className="bg-[#111] rounded p-2.5">
                  <div className="text-[#ff4444] font-bold mb-1">Avoid For</div>
                  <div className="text-gray-400">Secular growth stories (PLTR, AMD, NVDA, GOOGL, SMH)</div>
                </div>
                <div className="bg-[#111] rounded p-2.5">
                  <div className="text-gray-400 font-bold mb-1">Core Edge</div>
                  <div className="text-gray-400">Capital preservation in down-trending markets, not return generation</div>
                </div>
              </div>
              {config && (
                <div className="mt-3 text-xs text-gray-600">
                  Config: SL {config.stop_loss_atr}x ATR · TP1 {config.tp1_atr}x · TP2 {config.tp2_atr}x · Entry score &ge;{config.entry_threshold} · Trailing stop &bull; Trend filter &bull; Momentum filter &bull; 10% position size
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state when no results yet */}
      {status !== 'running' && results.length === 0 && !loadError && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="text-4xl font-mono text-gray-700">&#9654;</div>
          <div className="text-sm font-mono text-gray-500">Select tickers and a date range above, then click Run Backtest</div>
          <div className="text-xs text-gray-600">Results will appear here after the backtest completes</div>
        </div>
      )}

    </div>
  )
}

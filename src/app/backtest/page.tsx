export const dynamic = 'force-dynamic'

import { getBacktestData, getRecommendationData } from '@/lib/data'
import { FlaskConical, TrendingUp, TrendingDown, Trophy, AlertTriangle, Settings, Zap } from 'lucide-react'
import { EquityCurveChart, ExitReasonChart } from '@/components/BacktestCharts'
import RunBacktestButton from '@/components/RunBacktestButton'
import type { BacktestTrade, OptimizationResult } from '@/types/trading'

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
      <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 font-mono mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Win/Loss badge ─────────────────────────────────────────────
function WinBadge({ win }: { win: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${
        win
          ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
          : 'bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/30'
      }`}
    >
      {win ? 'WIN' : 'LOSS'}
    </span>
  )
}

// ── Optimization row ──────────────────────────────────────────
function OptimizationRow({ result }: { result: OptimizationResult }) {
  const isTop = result.rank === 1
  const alphaColor = result.alpha_pct > 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'
  const returnColor = result.total_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'
  const cfg = result.config
  return (
    <tr className={`border-b border-[#1a1a1a] transition-colors ${isTop ? 'bg-[#00ff88]/5 border-[#00ff88]/20' : 'hover:bg-[#151515]'}`}>
      <td className="px-3 py-2.5 font-mono text-xs">
        <span className={`font-bold ${isTop ? 'text-[#00ff88]' : 'text-gray-500'}`}>
          {isTop ? '★' : '#'}{result.rank}
        </span>
      </td>
      <td className={`px-3 py-2.5 font-mono text-xs font-bold ${returnColor}`}>
        {result.total_return_pct >= 0 ? '+' : ''}{result.total_return_pct.toFixed(1)}%
      </td>
      <td className={`px-3 py-2.5 font-mono text-xs font-bold ${alphaColor}`}>
        {result.alpha_pct >= 0 ? '+' : ''}{result.alpha_pct.toFixed(1)}%
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-300">{result.sharpe_ratio.toFixed(2)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-amber-400">-{result.max_drawdown_pct.toFixed(1)}%</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-300">{result.win_rate_pct.toFixed(1)}%</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{result.total_trades}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{cfg.stop_loss_atr}x</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{cfg.tp1_atr}x / {cfg.tp2_atr}x</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{cfg.entry_threshold}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">
        {cfg.time_stop_days == null ? 'None' : `${cfg.time_stop_days}d`}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{(cfg.position_size_pct * 100).toFixed(0)}%</td>
    </tr>
  )
}

// ── Trade row ─────────────────────────────────────────────────
function TradeRow({ trade, idx }: { trade: BacktestTrade; idx: number }) {
  const pnlColor = trade.win ? 'text-[#00ff88]' : 'text-[#ff4444]'
  return (
    <tr className={`border-b border-[#1a1a1a] hover:bg-[#151515] transition-colors ${trade.win ? '' : 'opacity-90'}`}>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{idx + 1}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-300">{trade.entry_date}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-300">{trade.exit_date}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-200">${trade.entry_price.toFixed(2)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-200">${trade.exit_price.toFixed(2)}</td>
      <td className={`px-3 py-2.5 font-mono text-xs font-bold ${pnlColor}`}>
        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
      </td>
      <td className={`px-3 py-2.5 font-mono text-xs font-bold ${pnlColor}`}>
        {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{trade.duration_days}d</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gray-500 max-w-[180px] truncate">{trade.exit_reason}</td>
      <td className="px-3 py-2.5"><WinBadge win={trade.win} /></td>
    </tr>
  )
}

export default async function BacktestPage() {
  const [data, rec] = await Promise.all([getBacktestData(), getRecommendationData()])
  const currentTicker = rec.ticker
  const backtestTicker = data.ticker
  const tickerMismatch = currentTicker !== backtestTicker
  const { performance: perf, benchmark, backtest_period, config, signal_distribution, trades, equity_curve } = data

  const totalReturn = perf.total_return_pct
  const returnColor = totalReturn >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'
  const alphaPositive = benchmark.alpha_pct > 0
  const beatsLabel = alphaPositive ? 'BEATS BUY & HOLD' : 'LAGS BUY & HOLD'
  const alphaColor = alphaPositive ? 'text-[#00ff88]' : 'text-[#ff4444]'
  const alphaBg = alphaPositive ? 'bg-[#00ff88]/10 border-[#00ff88]/20' : 'bg-[#ff4444]/10 border-[#ff4444]/20'

  // Build buy-and-hold reference curve aligned with equity_curve dates
  const bhStart = benchmark.start_price
  const bhEnd = benchmark.end_price
  const bhFinal = benchmark.final_value
  const initialCapital = config.initial_capital
  const bhShares = Math.floor(initialCapital / bhStart)
  const bhCash = initialCapital - bhShares * bhStart

  // Map each date to a B&H value using the equity curve's price field
  const bhCurve = equity_curve.map((pt) => ({
    date: pt.date,
    bh_value: Math.round(bhShares * pt.price + bhCash),
  }))

  const optimization = data.optimization

  return (
    <div className="p-6 space-y-6">
      {/* Ticker mismatch warning */}
      {tickerMismatch && (
        <RunBacktestButton ticker={currentTicker} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Backtest Results</h1>
            <p className="text-gray-500 text-sm font-mono">
              {data.ticker} · {backtest_period.start_date} to {backtest_period.end_date} · {backtest_period.trading_days} trading days
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 font-mono">Generated</div>
          <div className="text-xs text-gray-400 font-mono">{new Date(data.generated_at).toLocaleString()}</div>
        </div>
      </div>

      {/* Optimization Results */}
      {optimization && (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-[#00ff88]" />
            <div className="text-xs text-gray-500 font-mono uppercase tracking-widest">
              Parameter Optimization — {optimization.configs_tested} Configurations Tested
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  {['Rank', 'Return', 'Alpha', 'Sharpe', 'Max DD', 'Win Rate', 'Trades', 'SL ATR', 'TP1/TP2', 'Entry', 'Time Stop', 'Pos Size'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {optimization.top_10.map((r) => (
                  <OptimizationRow key={r.rank} result={r} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 font-mono">Ranked by Sharpe ratio (annualized, RF 4.5%). All configurations use trailing stops, bull regime filter, and momentum filter (MACD cross or RSI bounce).</p>
        </div>
      )}

      {/* Improvements Made */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-4 w-4 text-amber-400" />
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest">Strategy Improvements vs Original</div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs font-mono">
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">Trailing Stops</div>
            <div className="text-gray-400">After 1 ATR profit: stop moves to breakeven. After 2 ATR profit: stop trails 1 ATR below price. Protects gains without cutting winners short.</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">Partial Profit Taking</div>
            <div className="text-gray-400">Exit 50% of position at TP1 to lock in gains, let remaining 50% run to TP2. Improves win rate while keeping upside open.</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">Trend Filter (Bull Regime Only)</div>
            <div className="text-gray-400">Only enter new positions when MA50 &gt; MA200 (golden cross regime). Avoids fighting the trend in bear markets.</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">Momentum Filter</div>
            <div className="text-gray-400">Requires MACD histogram turning positive OR RSI bouncing up through 35 (oversold recovery). Confirms momentum before entry.</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">No-Chase Filter</div>
            <div className="text-gray-400">Skip entries when price is more than 50% above MA200. Avoids buying into extended parabolic moves that are prone to sharp reversals.</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#00ff88] font-bold">Time Stop Optimized</div>
            <div className="text-gray-400">Original hard 28-day time stop replaced. Best config uses no time stop — lets winners run as long as price holds above trailing stop.</div>
          </div>
        </div>
      </div>

      {/* Top 4 stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Return"
          value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`}
          sub={`$${perf.final_capital.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          color={returnColor}
        />
        <StatCard
          label="Win Rate"
          value={`${perf.win_rate_pct.toFixed(1)}%`}
          sub={`${perf.winning_trades}W / ${perf.losing_trades}L of ${perf.total_trades} trades`}
          color={perf.win_rate_pct >= 50 ? 'text-[#00ff88]' : 'text-amber-400'}
        />
        <StatCard
          label="Sharpe Ratio"
          value={perf.sharpe_ratio.toFixed(2)}
          sub="annualized, RF 4.5%"
          color={perf.sharpe_ratio >= 1 ? 'text-[#00ff88]' : perf.sharpe_ratio >= 0 ? 'text-amber-400' : 'text-[#ff4444]'}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${perf.max_drawdown_pct.toFixed(1)}%`}
          sub="peak-to-trough"
          color={perf.max_drawdown_pct < 10 ? 'text-[#00ff88]' : perf.max_drawdown_pct < 20 ? 'text-amber-400' : 'text-[#ff4444]'}
        />
      </div>

      {/* Strategy vs Buy & Hold */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Strategy vs Buy &amp; Hold</div>
        <div className="grid grid-cols-3 gap-6 items-center">
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">Strategy ({backtest_period.years}Y)</div>
            <div className={`text-3xl font-bold font-mono ${returnColor}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 font-mono mt-1">
              ${initialCapital.toLocaleString()} → ${perf.final_capital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded border font-mono font-bold text-sm ${alphaBg} ${alphaColor}`}>
              {alphaPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {beatsLabel}
            </div>
            <div className={`text-2xl font-bold font-mono mt-2 ${alphaColor}`}>
              {alphaPositive ? '+' : ''}{benchmark.alpha_pct.toFixed(1)}% alpha
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono mb-1">Buy &amp; Hold {data.ticker}</div>
            <div className="text-3xl font-bold font-mono text-gray-300">
              {benchmark.return_pct >= 0 ? '+' : ''}{benchmark.return_pct.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 font-mono mt-1">
              ${bhStart.toFixed(2)} → ${bhEnd.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest">Equity Curve</div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-6 bg-[#00ff88] rounded" />Strategy</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-6 bg-gray-500 rounded border-dashed" />Buy &amp; Hold</span>
          </div>
        </div>
        <EquityCurveChart
          equityCurve={equity_curve}
          initialCapital={initialCapital}
          bhCurve={bhCurve}
        />
      </div>

      {/* Trade metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Trade Metrics</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-mono">
            <div className="flex justify-between"><span className="text-gray-500">Total Trades</span><span className="text-white font-bold">{perf.total_trades}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Winners</span><span className="text-[#00ff88] font-bold">{perf.winning_trades}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Losers</span><span className="text-[#ff4444] font-bold">{perf.losing_trades}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Profit Factor</span><span className="text-white font-bold">{perf.profit_factor.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Win</span><span className="text-[#00ff88] font-bold">+{perf.avg_win_pct.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Loss</span><span className="text-[#ff4444] font-bold">{perf.avg_loss_pct.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Duration</span><span className="text-white font-bold">{perf.avg_duration_days.toFixed(0)} days</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Annualized</span><span className={`font-bold ${perf.annualized_return_pct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{perf.annualized_return_pct >= 0 ? '+' : ''}{perf.annualized_return_pct.toFixed(1)}%/yr</span></div>
          </div>

          {/* Best / Worst trade */}
          {perf.best_trade && (
            <div className="mt-4 pt-4 border-t border-[#1e1e1e] space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">Best Trade</span>
              </div>
              <div className="text-xs font-mono text-[#00ff88] font-bold">+{perf.best_trade.pnl_pct.toFixed(2)}% (+${perf.best_trade.pnl.toFixed(2)})</div>
              <div className="text-xs font-mono text-gray-500">{perf.best_trade.entry_date} → {perf.best_trade.exit_date} · {perf.best_trade.exit_reason}</div>
            </div>
          )}
          {perf.worst_trade && (
            <div className="mt-3 pt-3 border-t border-[#1e1e1e] space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-[#ff4444]" />
                <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">Worst Trade</span>
              </div>
              <div className="text-xs font-mono text-[#ff4444] font-bold">{perf.worst_trade.pnl_pct.toFixed(2)}% (${perf.worst_trade.pnl.toFixed(2)})</div>
              <div className="text-xs font-mono text-gray-500">{perf.worst_trade.entry_date} → {perf.worst_trade.exit_date} · {perf.worst_trade.exit_reason}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Exit reason breakdown */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
            <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Exit Reason Breakdown</div>
            <ExitReasonChart data={perf.exit_reason_breakdown} />
          </div>

          {/* Signal distribution */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
            <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Signal Distribution</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-[#00ff88]">{signal_distribution.buy}</div>
                <div className="text-xs text-gray-500 font-mono">BUY days</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-gray-400">{signal_distribution.hold}</div>
                <div className="text-xs text-gray-500 font-mono">HOLD days</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-[#ff4444]">{signal_distribution.sell}</div>
                <div className="text-xs text-gray-500 font-mono">SELL days</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backtest config */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Best Configuration (Optimized)</div>
        <div className="grid grid-cols-4 gap-x-8 gap-y-2 text-xs font-mono">
          <div className="flex justify-between gap-2"><span className="text-gray-500">Initial Capital</span><span className="text-white">${config.initial_capital.toLocaleString()}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Position Size</span><span className="text-white">{(config.position_size_pct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Commission</span><span className="text-white">${config.commission}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Entry Threshold</span><span className="text-white">&ge;{config.entry_signal_threshold}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Exit Threshold</span><span className="text-white">&le;{config.exit_signal_threshold}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Stop Loss ATR</span><span className="text-white">{config.stop_loss_atr_multiplier}x</span></div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">TP1 / TP2 ATR</span>
            <span className="text-white">
              {config.tp1_atr_multiplier != null ? `${config.tp1_atr_multiplier}x` : `${config.take_profit_atr_multiplier}x`}
              {config.tp2_atr_multiplier != null ? ` / ${config.tp2_atr_multiplier}x` : ''}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Time Stop</span>
            <span className="text-white">{config.time_stop_days == null ? 'None' : `${config.time_stop_days}d`}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Trailing Stop</span>
            <span className={config.use_trailing_stop ? 'text-[#00ff88]' : 'text-gray-400'}>{config.use_trailing_stop ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Trend Filter</span>
            <span className={config.trend_filter ? 'text-[#00ff88]' : 'text-gray-400'}>{config.trend_filter ? 'Bull regime only' : 'Off'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Momentum Filter</span>
            <span className={config.momentum_filter ? 'text-[#00ff88]' : 'text-gray-400'}>{config.momentum_filter ? 'MACD/RSI' : 'Off'}</span>
          </div>
          <div className="flex justify-between gap-2"><span className="text-gray-500">Period</span><span className="text-white">{backtest_period.years}Y ({backtest_period.trading_days} days)</span></div>
        </div>
      </div>

      {/* All trades table */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">
          All Trades ({trades.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222]">
                {['#', 'Entry', 'Exit', 'Entry $', 'Exit $', 'P&L $', 'P&L %', 'Duration', 'Exit Reason', 'Result'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, i) => (
                <TradeRow key={`${trade.entry_date}-${i}`} trade={trade} idx={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

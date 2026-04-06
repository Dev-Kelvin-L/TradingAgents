export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { getRecommendationData } from '@/lib/data'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Zap,
  Clock,
} from 'lucide-react'

interface Position {
  qty: number
  avg_entry: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  market_value: number
}

interface Safeguards {
  max_position_pct: number
  daily_loss_limit_pct: number
  min_confidence: number
  min_rr_ratio: number
  paper_trading: boolean
}

interface TradingStatus {
  last_run: string | null
  ticker: string
  current_price: number
  has_position: boolean
  signal: string
  confidence: number
  conviction: string
  account_equity: number
  account_buying_power: number
  position: Position | null
  safeguards: Safeguards
}

interface TradeEntry {
  timestamp: string
  action: string
  ticker: string
  shares?: number | string
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  order_id?: string
  confidence?: number
  conviction?: string
  rr_ratio?: number
  reason?: string
  unrealized_pnl?: number
  unrealized_pnl_pct?: string
  current_price?: number
}

interface TradeLog {
  trades: TradeEntry[]
  daily_pnl: Record<string, number>
  last_updated: string | null
}

function loadJson<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(process.cwd(), 'data', filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    BUY: { bg: 'bg-[#00ff88]/15', text: 'text-[#00ff88]', border: 'border-[#00ff88]/40' },
    SELL: { bg: 'bg-[#ff4444]/15', text: 'text-[#ff4444]', border: 'border-[#ff4444]/40' },
    HOLD: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40' },
    PENDING: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/40' },
  }
  const c = map[signal] || map.PENDING
  return (
    <span className={`inline-flex items-center px-4 py-1.5 rounded border text-sm font-mono font-bold tracking-widest ${c.bg} ${c.text} ${c.border}`}>
      {signal}
    </span>
  )
}

function ConvictionBadge({ conviction }: { conviction: string }) {
  const map: Record<string, string> = {
    HIGH: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    LOW: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${map[conviction] || map.LOW}`}>
      {conviction}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    ENTRY: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30',
    EXIT: 'text-[#ff4444] bg-[#ff4444]/10 border-[#ff4444]/30',
    HOLD: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    KILL_SWITCH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-bold ${map[action] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
      {action}
    </span>
  )
}

function ConfidenceBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 70 ? '#00ff88' : pct >= 40 ? '#f59e0b' : '#ff4444'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-sm font-bold" style={{ color }}>{value.toFixed(1)}/10</span>
    </div>
  )
}

function SafeguardRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle className="h-3.5 w-3.5 text-[#00ff88]" />
          : <AlertTriangle className="h-3.5 w-3.5 text-[#ff4444]" />
        }
        <span className="text-xs text-gray-400 font-mono">{label}</span>
      </div>
      <span className="text-xs font-mono font-bold text-white">{value}</span>
    </div>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return iso
  }
}

export default async function TradingPage() {
  const rec = await getRecommendationData()
  const status = loadJson<TradingStatus>('trading_status.json', {
    last_run: null,
    ticker: '',
    current_price: 0,
    has_position: false,
    signal: 'PENDING',
    confidence: 0,
    conviction: 'LOW',
    account_equity: 0,
    account_buying_power: 0,
    position: null,
    safeguards: {
      max_position_pct: 0.05,
      daily_loss_limit_pct: 0.02,
      min_confidence: 5.0,
      min_rr_ratio: 1.5,
      paper_trading: true,
    },
  })

  const tradeLog = loadJson<TradeLog>('trade_log.json', {
    trades: [],
    daily_pnl: {},
    last_updated: null,
  })

  const recentTrades = [...tradeLog.trades].reverse().slice(0, 10)
  const { safeguards } = status
  const pos = status.position
  const pnlColor = pos && pos.unrealized_pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'
  const PnlIcon = pos && pos.unrealized_pnl >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="p-6 space-y-6">

      {/* Current analysis ticker banner — shows when engine hasn't been run for this ticker yet */}
      {rec.ticker !== status.ticker && status.ticker && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <Activity className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 text-sm font-mono">
            <span className="text-blue-400 font-bold">Analysis updated for </span>
            <span className="text-white font-bold">{rec.ticker}</span>
            <span className="text-blue-400/70"> — Trading engine last ran on </span>
            <span className="text-gray-300">{status.ticker || '—'}</span>
            <span className="text-blue-400/70">. Restart trade_scheduler.py to trade {rec.ticker}.</span>
          </div>
        </div>
      )}

      {/* PAPER TRADING Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div className="flex-1">
          <span className="font-mono text-sm font-bold text-amber-400 tracking-widest">PAPER TRADING MODE</span>
          <span className="ml-3 text-xs text-amber-400/70 font-mono">No real money at risk — all orders execute on Alpaca Paper Trading</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-amber-400">SIMULATED</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Automated Trading Engine</h1>
            <p className="text-gray-500 text-sm font-mono">{rec.ticker} · Alpaca Paper · 15-min cycle</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 font-mono flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3" />
            Last run
          </div>
          <div className="text-xs font-mono text-gray-300">{formatTime(status.last_run)}</div>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Current Price',
            value: status.current_price > 0 ? `$${status.current_price.toFixed(2)}` : '—',
            color: 'text-white',
            icon: <DollarSign className="h-4 w-4 text-gray-500" />,
          },
          {
            label: 'Account Equity',
            value: status.account_equity > 0 ? `$${status.account_equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            color: 'text-[#00ff88]',
            icon: <TrendingUp className="h-4 w-4 text-[#00ff88]" />,
          },
          {
            label: 'Buying Power',
            value: status.account_buying_power > 0 ? `$${status.account_buying_power.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            color: 'text-amber-400',
            icon: <Zap className="h-4 w-4 text-amber-400" />,
          },
          {
            label: 'Position',
            value: status.has_position ? `${pos?.qty ?? 0} shares` : 'FLAT',
            color: status.has_position ? 'text-[#00ff88]' : 'text-gray-500',
            icon: <Activity className="h-4 w-4 text-gray-500" />,
          },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-2">
              {icon}
              <div className="text-xs text-gray-500 font-mono uppercase">{label}</div>
            </div>
            <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Signal + Confidence */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Current Signal</div>
          <div className="flex items-center gap-4 mb-4">
            <SignalBadge signal={status.signal} />
            <ConvictionBadge conviction={status.conviction} />
          </div>
          <div className="text-xs text-gray-500 font-mono mb-2 uppercase">Confidence Score</div>
          <ConfidenceBar value={status.confidence} />
          <div className="mt-4 pt-4 border-t border-[#1a1a1a] grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <div className="text-gray-500">Min Required</div>
              <div className="text-white font-bold">{safeguards.min_confidence}/10</div>
            </div>
            <div>
              <div className="text-gray-500">Min R:R</div>
              <div className="text-white font-bold">{safeguards.min_rr_ratio}:1</div>
            </div>
          </div>
        </div>

        {/* Position Detail */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Open Position</div>
          {pos ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PnlIcon className={`h-5 w-5 ${pnlColor}`} />
                <div className={`font-mono text-2xl font-black ${pnlColor}`}>
                  {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                </div>
                <div className={`font-mono text-sm ${pnlColor}`}>
                  ({(pos.unrealized_pnl_pct * 100).toFixed(2)}%)
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <div className="text-gray-500">Shares</div>
                  <div className="text-white font-bold text-base">{pos.qty}</div>
                </div>
                <div>
                  <div className="text-gray-500">Avg Entry</div>
                  <div className="text-white font-bold text-base">${pos.avg_entry.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Mkt Value</div>
                  <div className="text-white font-bold text-base">${pos.market_value.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-gray-600">
              <Activity className="h-8 w-8 mb-2 opacity-30" />
              <div className="font-mono text-sm">No open position</div>
              <div className="font-mono text-xs mt-1 text-gray-700">Waiting for BUY signal</div>
            </div>
          )}
        </div>
      </div>

      {/* Safeguards */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#00ff88]" />
          <div className="text-sm font-mono text-white uppercase tracking-widest">Safeguards &amp; Risk Controls</div>
        </div>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <SafeguardRow
              label="Paper Trading Mode"
              value={safeguards.paper_trading ? 'ENABLED' : 'DISABLED'}
              ok={safeguards.paper_trading}
            />
            <SafeguardRow
              label="Max Position Size"
              value={`${(safeguards.max_position_pct * 100).toFixed(0)}% of portfolio`}
              ok={true}
            />
            <SafeguardRow
              label="Daily Loss Kill Switch"
              value={`-${(safeguards.daily_loss_limit_pct * 100).toFixed(0)}% portfolio`}
              ok={true}
            />
          </div>
          <div>
            <SafeguardRow
              label="Min Confidence Threshold"
              value={`${safeguards.min_confidence}/10`}
              ok={true}
            />
            <SafeguardRow
              label="Min Risk/Reward Ratio"
              value={`${safeguards.min_rr_ratio}:1`}
              ok={true}
            />
            <SafeguardRow
              label="Bracket Orders (SL + TP)"
              value="ENABLED"
              ok={true}
            />
          </div>
        </div>
      </div>

      {/* Recent Trade Log */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Recent Trade Activity</div>
          </div>
          <div className="text-xs text-gray-500 font-mono">Last 10 events</div>
        </div>

        {recentTrades.length === 0 ? (
          <div className="text-center py-10 text-gray-600">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <div className="font-mono text-sm">No trades recorded yet</div>
            <div className="font-mono text-xs mt-1 text-gray-700">Run <code className="bg-[#1a1a1a] px-1 rounded">python trade_scheduler.py</code> to start</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  {['Time', 'Action', 'Details', 'P&L'].map((h) => (
                    <th key={h} className="text-left text-xs font-mono text-gray-500 uppercase pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]">
                {recentTrades.map((trade, i) => (
                  <tr key={i} className="hover:bg-[#141414] transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <ActionBadge action={trade.action} />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-300">
                      {trade.action === 'ENTRY' && trade.shares && (
                        <span>{trade.shares} sh @ ${trade.entry_price?.toFixed(2)} · SL ${trade.stop_loss} · TP ${trade.take_profit}</span>
                      )}
                      {trade.action === 'EXIT' && (
                        <span>{trade.shares} sh · {trade.reason}</span>
                      )}
                      {trade.action === 'HOLD' && (
                        <span>{trade.shares} sh @ ${trade.current_price?.toFixed(2)}</span>
                      )}
                      {trade.action === 'KILL_SWITCH' && (
                        <span className="text-orange-400">{trade.reason}</span>
                      )}
                    </td>
                    <td className="py-2.5 font-mono text-xs">
                      {trade.unrealized_pnl !== undefined ? (
                        <span className={trade.unrealized_pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
                          {trade.unrealized_pnl >= 0 ? '+' : ''}${trade.unrealized_pnl.toFixed(2)}
                          {trade.unrealized_pnl_pct ? ` (${trade.unrealized_pnl_pct})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How to Run */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">How to Run the Automated Trader</div>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-[#00ff88] font-mono text-xs font-bold mt-0.5">1.</span>
            <code className="text-xs font-mono text-gray-300 bg-[#111] px-2 py-1 rounded border border-[#1e1e1e]">python trade_scheduler.py</code>
            <span className="text-xs text-gray-500">— starts the full automated loop (runs every 15 min during market hours)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-[#00ff88] font-mono text-xs font-bold mt-0.5">2.</span>
            <code className="text-xs font-mono text-gray-300 bg-[#111] px-2 py-1 rounded border border-[#1e1e1e]">python trade_engine.py</code>
            <span className="text-xs text-gray-500">— single run of the engine (reads signals, evaluates, places orders)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-[#00ff88] font-mono text-xs font-bold mt-0.5">3.</span>
            <span className="text-xs text-gray-400">Logs: <code className="bg-[#111] px-1 rounded border border-[#1e1e1e]">data/trade_engine.log</code> and <code className="bg-[#111] px-1 rounded border border-[#1e1e1e]">data/trade_log.json</code></span>
          </div>
        </div>
      </div>
    </div>
  )
}

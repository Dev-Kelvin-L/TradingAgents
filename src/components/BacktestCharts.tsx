'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { EquityCurvePoint } from '@/types/trading'

// ── Equity Curve Chart ─────────────────────────────────────────
interface EquityChartProps {
  equityCurve: EquityCurvePoint[]
  initialCapital: number
  bhCurve: { date: string; bh_value: number }[]
}

interface EquityTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function EquityTooltip({ active, payload, label }: EquityTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded p-3 text-xs font-mono">
        <div className="text-gray-400 mb-2">{label}</div>
        {payload.map((p) => (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="text-white font-bold">${p.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function EquityCurveChart({ equityCurve, initialCapital, bhCurve }: EquityChartProps) {
  // Merge strategy + B&H data by date
  const bhMap = new Map(bhCurve.map((d) => [d.date, d.bh_value]))
  const merged = equityCurve.map((d) => ({
    date: d.date.slice(5), // MM-DD
    fullDate: d.date,
    strategy: d.portfolio_value,
    buyhold: bhMap.get(d.date) ?? initialCapital,
  }))

  const allValues = merged.flatMap((d) => [d.strategy, d.buyhold])
  const minVal = Math.min(...allValues) * 0.98
  const maxVal = Math.max(...allValues) * 1.02

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="bhGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#888" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#888" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#222' }}
          interval={Math.floor(merged.length / 8)}
        />
        <YAxis
          domain={[minVal, maxVal]}
          tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#222' }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          width={52}
        />
        <Tooltip content={<EquityTooltip />} />
        <Area
          type="monotone"
          dataKey="buyhold"
          name="Buy & Hold"
          stroke="#666"
          strokeWidth={1.5}
          fill="url(#bhGrad)"
          dot={false}
          strokeDasharray="4 4"
        />
        <Area
          type="monotone"
          dataKey="strategy"
          name="Strategy"
          stroke="#00ff88"
          strokeWidth={2}
          fill="url(#stratGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#00ff88', stroke: '#0a0a0a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Exit Reason Bar Chart ──────────────────────────────────────
interface ExitReasonChartProps {
  data: Record<string, number>
}

const EXIT_COLORS: Record<string, string> = {
  'Stop Loss': '#ff4444',
  'Take Profit 2': '#00ff88',
  'Take Profit 1 + Signal Reversal': '#4ade80',
  'Signal Reversal (strong SELL)': '#f59e0b',
  'Time Stop (4 weeks)': '#818cf8',
  'End of Backtest (open position)': '#94a3b8',
}

export function ExitReasonChart({ data }: ExitReasonChartProps) {
  const chartData = Object.entries(data).map(([reason, count]) => ({
    reason: reason.length > 22 ? reason.slice(0, 22) + '…' : reason,
    fullReason: reason,
    count,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#222' }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="reason"
          tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          width={160}
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${value} trades`,
            (props.payload as { fullReason?: string } | undefined)?.fullReason ?? '',
          ]}
          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}
          labelStyle={{ display: 'none' }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.reason}
              fill={EXIT_COLORS[entry.fullReason] ?? '#555'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { PriceCandle } from '@/types/trading'

interface PriceChartProps {
  data: PriceCandle[]
  support: number
  resistance: number
  ma50: number
  ma200: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: PriceCandle }>
  label?: string
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded p-3 text-xs font-mono">
        <div className="text-gray-400 mb-1">{d.date}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-500">Open</span><span className="text-white">${d.open.toFixed(2)}</span>
          <span className="text-gray-500">High</span><span className="text-[#00ff88]">${d.high.toFixed(2)}</span>
          <span className="text-gray-500">Low</span><span className="text-[#ff4444]">${d.low.toFixed(2)}</span>
          <span className="text-gray-500">Close</span><span className="text-white font-bold">${d.close.toFixed(2)}</span>
          <span className="text-gray-500">Vol</span><span className="text-amber-400">{(d.volume / 1e6).toFixed(1)}M</span>
        </div>
      </div>
    )
  }
  return null
}

export default function PriceChart({ data, support, resistance, ma50, ma200 }: PriceChartProps) {
  const minPrice = Math.min(...data.map((d) => d.low)) - 30
  const maxPrice = Math.max(...data.map((d) => d.high)) + 30

  const shortDates = data.map((d) => ({
    ...d,
    shortDate: d.date.slice(5),
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={shortDates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff88" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="shortDate"
          tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#222' }}
          interval={4}
        />
        <YAxis
          domain={[minPrice, maxPrice]}
          tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#222' }}
          tickFormatter={(v: number) => `$${v}`}
          width={65}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={support} stroke="#00ff88" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Sup $${support}`, fill: '#00ff88', fontSize: 9, fontFamily: 'monospace' }} />
        <ReferenceLine y={resistance} stroke="#ff4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Res $${resistance}`, fill: '#ff4444', fontSize: 9, fontFamily: 'monospace' }} />
        <ReferenceLine y={ma50} stroke="#f59e0b" strokeDasharray="2 4" strokeOpacity={0.6} label={{ value: `MA50 $${ma50}`, fill: '#f59e0b', fontSize: 9, fontFamily: 'monospace' }} />
        <ReferenceLine y={ma200} stroke="#a855f7" strokeDasharray="2 4" strokeOpacity={0.6} label={{ value: `MA200 $${ma200}`, fill: '#a855f7', fontSize: 9, fontFamily: 'monospace' }} />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#00ff88"
          strokeWidth={2}
          fill="url(#priceGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#00ff88', stroke: '#0a0a0a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

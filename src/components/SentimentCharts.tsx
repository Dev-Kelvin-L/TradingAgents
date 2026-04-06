'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface RatingsChartProps {
  buy: number
  hold: number
  sell: number
}

export function RatingsChart({ buy, hold, sell }: RatingsChartProps) {
  const data = [
    { name: 'Buy', value: buy, color: '#00ff88' },
    { name: 'Hold', value: hold, color: '#f59e0b' },
    { name: 'Sell', value: sell, color: '#ff4444' },
  ]
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11, fontFamily: 'monospace' }} axisLine={{ stroke: '#222' }} tickLine={false} />
        <YAxis tick={{ fill: '#666', fontSize: 11, fontFamily: 'monospace' }} axisLine={{ stroke: '#222' }} tickLine={false} width={30} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}
          labelStyle={{ color: '#999' }}
          itemStyle={{ color: '#fff' }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface SentimentMeterProps {
  score: number
}

export function SentimentMeter({ score }: SentimentMeterProps) {
  const pct = ((score + 100) / 200) * 100
  const color = score > 20 ? '#00ff88' : score < -20 ? '#ff4444' : '#f59e0b'
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-mono text-gray-500">
        <span>-100 Bearish</span>
        <span className="font-bold" style={{ color }}>{score > 0 ? '+' : ''}{score}</span>
        <span>+100 Bullish</span>
      </div>
      <div className="relative h-4 bg-gradient-to-r from-[#ff4444]/30 via-amber-400/30 to-[#00ff88]/30 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#0a0a0a] shadow-lg"
          style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }}
        />
      </div>
      <div className="text-center text-xs font-mono" style={{ color }}>
        {score > 50 ? 'STRONGLY BULLISH' : score > 20 ? 'BULLISH' : score > -20 ? 'NEUTRAL' : score > -50 ? 'BEARISH' : 'STRONGLY BEARISH'}
      </div>
    </div>
  )
}

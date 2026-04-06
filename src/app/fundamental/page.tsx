export const dynamic = 'force-dynamic'

import { getFundamentalData } from '@/lib/data'
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Zap, Users } from 'lucide-react'

function SignalBadge({ signal }: { signal: string }) {
  const configs: Record<string, { bg: string; text: string; border: string }> = {
    BULLISH: { bg: 'bg-[#00ff88]/10', text: 'text-[#00ff88]', border: 'border-[#00ff88]/30' },
    BEARISH: { bg: 'bg-[#ff4444]/10', text: 'text-[#ff4444]', border: 'border-[#ff4444]/30' },
    NEUTRAL: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  }
  const c = configs[signal] || configs.NEUTRAL
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-mono font-bold ${c.bg} ${c.text} ${c.border}`}>
      {signal}
    </span>
  )
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: 'text-[#ff4444] bg-[#ff4444]/10 border-[#ff4444]/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    LOW: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${colors[level] || colors.LOW}`}>
      {level}
    </span>
  )
}

function MetricCard({ label, value, assessment }: { label: string; value: string | number; assessment: string }) {
  const isPositive = assessment.toLowerCase().startsWith('strong') || assessment.toLowerCase().startsWith('exceptional') || assessment.toLowerCase().startsWith('conservative')
  const isNegative = assessment.toLowerCase().startsWith('weak') || assessment.toLowerCase().startsWith('high risk')
  const borderColor = isPositive ? 'border-[#00ff88]/20' : isNegative ? 'border-[#ff4444]/20' : 'border-[#1e1e1e]'

  return (
    <div className={`bg-[#111] border ${borderColor} rounded-lg p-4`}>
      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-xl font-bold text-white mb-2">{value}</div>
      <p className="text-gray-400 text-xs leading-relaxed">{assessment}</p>
    </div>
  )
}

export default async function FundamentalPage() {
  const data = await getFundamentalData()
  const m = data.metrics

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Fundamental Analysis</h1>
            <p className="text-gray-500 text-sm">{data.analyst} · {data.ticker}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono">Confidence</div>
            <div className="font-mono text-2xl font-bold text-white">{data.confidence_score}/10</div>
          </div>
          <SignalBadge signal={data.signal} />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Executive Summary</div>
        <p className="text-gray-300 leading-relaxed">{data.summary}</p>
      </div>

      {/* Financial Metrics */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-3">Financial Metrics</h2>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="P/E Ratio" value={m.pe_ratio.value as number} assessment={m.pe_ratio.assessment} />
          <MetricCard label="Revenue Growth YoY" value={m.revenue_growth_yoy.value as string} assessment={m.revenue_growth_yoy.assessment} />
          <MetricCard label="Earnings Growth YoY" value={m.earnings_growth_yoy.value as string} assessment={m.earnings_growth_yoy.assessment} />
          <MetricCard label="Profit Margin" value={m.profit_margin.value as string} assessment={m.profit_margin.assessment} />
          <MetricCard label="Debt / Equity" value={m.debt_to_equity.value as number} assessment={m.debt_to_equity.assessment} />
          <MetricCard label="Free Cash Flow" value={m.free_cash_flow.value as string} assessment={m.free_cash_flow.assessment} />
          <MetricCard label="Return on Equity" value={m.return_on_equity.value as string} assessment={m.return_on_equity.assessment} />
          <MetricCard label="Current Ratio" value={m.current_ratio.value as number} assessment={m.current_ratio.assessment} />
        </div>
      </div>

      {/* Metrics comparison bar chart — driven by JSON data */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Key Metrics vs Industry</div>
        <div className="space-y-4">
          {[
            { label: 'P/E Ratio', nvda: data.metrics.pe_ratio.value as number, industry: data.metrics.pe_ratio.industry_avg as number, max: Math.max((data.metrics.pe_ratio.value as number) * 1.5, 50), higherIsBad: true },
            { label: 'Profit Margin %', nvda: parseFloat((data.metrics.profit_margin.value as string).replace('%','')), industry: 18.0, max: 70, higherIsBad: false },
            { label: 'Revenue Growth %', nvda: parseFloat((data.metrics.revenue_growth_yoy.value as string).replace('%','')), industry: 12, max: Math.max(parseFloat((data.metrics.revenue_growth_yoy.value as string).replace('%','')) * 1.3, 30), higherIsBad: false },
            { label: 'Return on Equity %', nvda: parseFloat((data.metrics.return_on_equity.value as string).replace('%','')), industry: 22, max: Math.max(parseFloat((data.metrics.return_on_equity.value as string).replace('%','')) * 1.3, 50), higherIsBad: false },
            { label: 'Debt / Equity', nvda: data.metrics.debt_to_equity.value as number, industry: 0.85, max: Math.max((data.metrics.debt_to_equity.value as number) * 2, 1.5), higherIsBad: true },
          ].map((item) => {
            const nvdaPct = (item.nvda / item.max) * 100
            const industryPct = (item.industry / item.max) * 100
            const nvdaColor = item.higherIsBad
              ? item.nvda > item.industry ? '#ff4444' : '#00ff88'
              : item.nvda > item.industry ? '#00ff88' : '#ff4444'
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-gray-400">{item.label}</span>
                  <div className="flex gap-4">
                    <span style={{ color: nvdaColor }}>{data.ticker}: {item.nvda}</span>
                    <span className="text-gray-600">Avg: {item.industry}</span>
                  </div>
                </div>
                <div className="relative h-4 bg-[#1a1a1a] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${industryPct}%`, backgroundColor: '#333' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded opacity-80"
                    style={{ width: `${Math.min(nvdaPct, 100)}%`, backgroundColor: nvdaColor }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs font-mono">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#00ff88]" /><span className="text-gray-500">{data.ticker}</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded bg-[#333]" /><span className="text-gray-500">Industry Avg</span></div>
        </div>
      </div>

      {/* Insider Activity */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-amber-400" />
          <div className="text-sm font-mono text-white uppercase tracking-widest">Insider Activity</div>
          <div className="ml-auto">
            <SignalBadge signal={data.insider_activity.net_sentiment} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                {['Type', 'Executive', 'Shares', 'Date', 'Significance'].map((h) => (
                  <th key={h} className="text-left text-xs font-mono text-gray-500 uppercase pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {data.insider_activity.recent_transactions.map((tx, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4">
                    <span className={`font-mono text-xs font-bold ${tx.type === 'BUY' ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{tx.type}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300 text-xs">{tx.executive}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-white">{tx.shares.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-400">{tx.date}</td>
                  <td className="py-2 text-gray-500 text-xs">{tx.significance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 pt-3 border-t border-[#1e1e1e]">
          <p className="text-gray-400 text-xs leading-relaxed">{data.insider_activity.assessment}</p>
        </div>
      </div>

      {/* Catalysts + Risks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-[#00ff88]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Catalysts</div>
          </div>
          <div className="space-y-4">
            {data.catalysts.map((c, i) => (
              <div key={i} className="border-l-2 border-[#00ff88]/30 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-semibold">{c.catalyst}</span>
                  <SeverityBadge level={c.impact} />
                </div>
                <div className="text-xs text-gray-500 font-mono mb-1">{c.timeframe}</div>
                <p className="text-gray-400 text-xs leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-[#ff4444]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Risks</div>
          </div>
          <div className="space-y-4">
            {data.risks.map((r, i) => (
              <div key={i} className="border-l-2 border-[#ff4444]/30 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-semibold">{r.risk}</span>
                  <SeverityBadge level={r.severity} />
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bull / Bear Cases */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#00ff88]" />
            <div className="text-[#00ff88] font-mono text-xs uppercase tracking-widest">Bull Case</div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{data.bull_case}</p>
        </div>
        <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-[#ff4444]" />
            <div className="text-[#ff4444] font-mono text-xs uppercase tracking-widest">Bear Case</div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{data.bear_case}</p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Analyst Reasoning</div>
        <p className="text-gray-300 text-sm leading-relaxed">{data.reasoning}</p>
      </div>
    </div>
  )
}

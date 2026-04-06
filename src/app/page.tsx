export const dynamic = 'force-dynamic'

import { getRecommendationData, getFundamentalData, getTechnicalData, getSentimentData, getRiskData } from '@/lib/data'
import { TrendingUp, TrendingDown, Minus, Target, ShieldAlert, ChevronRight } from 'lucide-react'

function SignalBadge({ signal }: { signal: string }) {
  const configs = {
    BUY: { bg: 'bg-[#00ff88]/10', text: 'text-[#00ff88]', border: 'border-[#00ff88]/30', label: 'BUY' },
    SELL: { bg: 'bg-[#ff4444]/10', text: 'text-[#ff4444]', border: 'border-[#ff4444]/30', label: 'SELL' },
    HOLD: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'HOLD' },
    BULLISH: { bg: 'bg-[#00ff88]/10', text: 'text-[#00ff88]', border: 'border-[#00ff88]/30', label: 'BULLISH' },
    BEARISH: { bg: 'bg-[#ff4444]/10', text: 'text-[#ff4444]', border: 'border-[#ff4444]/30', label: 'BEARISH' },
    NEUTRAL: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'NEUTRAL' },
  }
  const config = configs[signal as keyof typeof configs] || configs.NEUTRAL
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-mono font-bold ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  )
}

function ConvictionBadge({ conviction }: { conviction: string }) {
  const colors = {
    HIGH: 'text-[#00ff88]',
    MEDIUM: 'text-amber-400',
    LOW: 'text-[#ff4444]',
  }
  return (
    <span className={`font-mono text-sm font-bold ${colors[conviction as keyof typeof colors] || 'text-gray-400'}`}>
      {conviction}
    </span>
  )
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = pct >= 70 ? '#00ff88' : pct >= 50 ? '#f59e0b' : '#ff4444'
  return (
    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default async function DashboardPage() {
  const [rec, fund, tech, sent, risk] = await Promise.all([
    getRecommendationData(),
    getFundamentalData(),
    getTechnicalData(),
    getSentimentData(),
    getRiskData(),
  ])

  const analystCards = [
    {
      name: 'Fundamental Analyst',
      role: 'Fundamentals',
      signal: fund.signal,
      score: fund.confidence_score,
      summary: fund.summary,
    },
    {
      name: 'Technical Analyst',
      role: 'Price Action',
      signal: tech.signal,
      score: tech.confidence_score,
      summary: tech.summary,
    },
    {
      name: 'Sentiment Analyst',
      role: 'Market Sentiment',
      signal: sent.signal,
      score: sent.confidence_score,
      summary: sent.summary,
    },
    {
      name: 'Risk Manager',
      role: 'Risk Assessment',
      signal: risk.overall_risk_level === 'HIGH' || risk.overall_risk_level === 'VERY HIGH' ? 'BEARISH' : 'NEUTRAL',
      score: rec.analyst_scores.risk_adjusted,
      summary: risk.summary,
    },
  ]

  const signalIcon = rec.signal === 'BUY'
    ? <TrendingUp className="h-8 w-8 text-[#00ff88]" />
    : rec.signal === 'SELL'
    ? <TrendingDown className="h-8 w-8 text-[#ff4444]" />
    : <Minus className="h-8 w-8 text-amber-400" />

  const signalColor = rec.signal === 'BUY' ? 'text-[#00ff88]' : rec.signal === 'SELL' ? 'text-[#ff4444]' : 'text-amber-400'
  const signalBg = rec.signal === 'BUY' ? 'bg-[#00ff88]/5 border-[#00ff88]/20' : rec.signal === 'SELL' ? 'bg-[#ff4444]/5 border-[#ff4444]/20' : 'bg-amber-500/5 border-amber-500/20'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{rec.ticker} · Swing Trade Analysis · {new Date(rec.timestamp).toISOString().slice(0, 10)}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-white">${tech.current_price.toFixed(2)}</div>
          <div className="font-mono text-sm text-gray-500">Entry price · {rec.trade_parameters.timeframe}</div>
        </div>
      </div>

      {/* Main Signal Card */}
      <div className={`rounded-lg border p-6 ${signalBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {signalIcon}
            <div>
              <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Lead Coordinator Signal</div>
              <div className={`text-5xl font-mono font-black ${signalColor}`}>{rec.signal}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-gray-400 text-sm">Conviction:</span>
                <ConvictionBadge conviction={rec.conviction} />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono mb-1">CONFIDENCE SCORE</div>
            <div className="text-6xl font-mono font-black text-white">{rec.overall_confidence_score}</div>
            <div className="text-gray-500 font-mono text-sm">/ 10</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-gray-300 text-sm leading-relaxed">{rec.final_summary}</p>
        </div>
      </div>

      {/* Analyst Cards Grid */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-3">Analyst Panel</h2>
        <div className="grid grid-cols-2 gap-4">
          {analystCards.map((card) => (
            <div key={card.name} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4 hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-semibold text-sm">{card.name}</div>
                  <div className="text-gray-500 text-xs font-mono">{card.role}</div>
                </div>
                <SignalBadge signal={card.signal} />
              </div>
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 font-mono">Confidence</span>
                  <span className="font-mono text-sm font-bold text-white">{card.score}/10</span>
                </div>
                <ScoreBar score={card.score} />
              </div>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{card.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trade Parameters + Catalysts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Trade Parameters */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-[#00ff88]" />
            <h2 className="text-sm font-mono text-white uppercase tracking-widest">Trade Parameters</h2>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Entry Price', value: `$${rec.trade_parameters.entry_price.toFixed(2)}`, color: 'text-white' },
              { label: 'Entry Zone', value: `$${rec.trade_parameters.entry_zone.low} – $${rec.trade_parameters.entry_zone.high}`, color: 'text-white' },
              { label: 'Stop Loss', value: `$${rec.trade_parameters.stop_loss} (${rec.trade_parameters.stop_loss_percentage})`, color: 'text-[#ff4444]' },
              { label: 'Target 1', value: `$${rec.trade_parameters.take_profit_1}`, color: 'text-[#00ff88]' },
              { label: 'Target 2', value: `$${rec.trade_parameters.take_profit_2}`, color: 'text-[#00ff88]' },
              { label: 'Target 3', value: `$${rec.trade_parameters.take_profit_3}`, color: 'text-[#00ff88]' },
              { label: 'Position Size', value: rec.trade_parameters.position_size_percentage, color: 'text-amber-400' },
              { label: 'Risk/Reward', value: rec.trade_parameters.risk_reward_ratio, color: 'text-amber-400' },
              { label: 'Timeframe', value: rec.trade_parameters.timeframe, color: 'text-gray-300' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-gray-500 font-mono text-xs">{row.label}</span>
                <span className={`font-mono text-sm font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Catalysts to Watch */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-mono text-white uppercase tracking-widest">Catalysts to Watch</h2>
          </div>
          <div className="space-y-3">
            {rec.rationale.catalysts_to_watch.map((catalyst, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="h-3 w-3 text-[#00ff88] mt-0.5 flex-shrink-0" />
                <p className="text-gray-400 text-xs leading-relaxed">{catalyst}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e1e1e]">
            <div className="text-xs text-gray-500 font-mono mb-2">KEY RISKS</div>
            <div className="space-y-2">
              {rec.rationale.key_risks.slice(0, 3).map((risk, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#ff4444] mt-1.5 flex-shrink-0" />
                  <p className="text-gray-500 text-xs leading-relaxed">{risk}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bull / Bear Cases */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-4">
          <div className="text-[#00ff88] font-mono text-xs uppercase tracking-widest mb-2">Bull Case</div>
          <p className="text-gray-300 text-sm leading-relaxed">{rec.rationale.bull_case}</p>
        </div>
        <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-4">
          <div className="text-[#ff4444] font-mono text-xs uppercase tracking-widest mb-2">Bear Case</div>
          <p className="text-gray-300 text-sm leading-relaxed">{rec.rationale.bear_case}</p>
        </div>
      </div>
    </div>
  )
}

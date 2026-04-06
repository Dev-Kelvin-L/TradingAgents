export const dynamic = 'force-dynamic'

import { getRiskData } from '@/lib/data'
import { Shield, AlertTriangle, TrendingDown, BarChart2, Target } from 'lucide-react'

function RiskLevelBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    'VERY HIGH': { bg: 'bg-[#ff4444]/20', text: 'text-[#ff4444]', border: 'border-[#ff4444]/40' },
    'HIGH': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
    'MEDIUM': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
    'LOW': { bg: 'bg-[#00ff88]/20', text: 'text-[#00ff88]', border: 'border-[#00ff88]/40' },
  }
  const c = colors[level] || colors.MEDIUM
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded border text-sm font-mono font-bold ${c.bg} ${c.text} ${c.border}`}>
      {level}
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

export default async function RiskPage() {
  const data = await getRiskData()
  const { risk_metrics, position_sizing, risk_reward_analysis, stop_loss_recommendation, challenges } = data

  const assessmentColor = risk_reward_analysis.assessment === 'FAVORABLE' ? 'text-[#00ff88]' : risk_reward_analysis.assessment === 'UNFAVORABLE' ? 'text-[#ff4444]' : 'text-amber-400'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-[#ff4444]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Risk Analysis</h1>
            <p className="text-gray-500 text-sm">{data.analyst} · {data.ticker}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono">Overall Risk Level</div>
          </div>
          <RiskLevelBadge level={data.overall_risk_level} />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-[#ff4444]" />
          <div className="text-xs text-[#ff4444] font-mono uppercase tracking-widest">Risk Summary</div>
        </div>
        <p className="text-gray-300 leading-relaxed">{data.summary}</p>
      </div>

      {/* Risk Metrics Grid */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-3">Risk Metrics</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { l: 'Max Drawdown Risk', v: risk_metrics.max_drawdown_risk, color: 'text-[#ff4444]' },
            { l: 'Volatility', v: risk_metrics.volatility_assessment, color: risk_metrics.volatility_assessment === 'HIGH' ? 'text-[#ff4444]' : 'text-amber-400' },
            { l: 'Liquidity Risk', v: risk_metrics.liquidity_risk, color: risk_metrics.liquidity_risk === 'LOW' ? 'text-[#00ff88]' : 'text-[#ff4444]' },
            { l: 'VaR (95%, 4-week)', v: risk_metrics.var_95.split(' ')[0], color: 'text-[#ff4444]' },
          ].map(({ l, v, color }) => (
            <div key={l} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">{l}</div>
              <div className={`font-mono text-xl font-bold ${color}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Downside Scenarios */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-4 w-4 text-[#ff4444]" />
          <div className="text-sm font-mono text-white uppercase tracking-widest">Downside Scenarios</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                {['Scenario', 'Probability', 'Price Impact', 'Est. Price', 'Trigger'].map((h) => (
                  <th key={h} className="text-left text-xs font-mono text-gray-500 uppercase pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {data.downside_scenarios.map((s, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4">
                    <div className="text-white text-sm font-semibold">{s.scenario}</div>
                    <div className="text-gray-500 text-xs mt-0.5 max-w-xs">{s.description.slice(0, 80)}...</div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-amber-400 font-bold text-sm">{s.probability}</td>
                  <td className="py-3 pr-4 font-mono text-[#ff4444] font-bold text-sm">{s.price_impact}</td>
                  <td className="py-3 pr-4 font-mono text-white font-bold text-sm">${s.estimated_price}</td>
                  <td className="py-3 text-gray-400 text-xs max-w-xs">{s.trigger.slice(0, 60)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analyst Challenges */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-3">Analyst Challenges</h2>
        <div className="space-y-4">
          {[
            { title: 'Fundamental Challenges', items: challenges.fundamental_challenges, color: 'border-[#00ff88]/20' },
            { title: 'Technical Challenges', items: challenges.technical_challenges, color: 'border-amber-500/20' },
            { title: 'Sentiment Challenges', items: challenges.sentiment_challenges, color: 'border-purple-500/20' },
          ].map(({ title, items, color }) => (
            <div key={title} className={`bg-[#111] border ${color} rounded-lg p-5`}>
              <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">{title}</div>
              <div className="space-y-4">
                {items.map((ch, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <SeverityBadge level={ch.severity} />
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 font-mono mb-1">ANALYST CLAIMED:</div>
                        <p className="text-gray-400 text-xs italic leading-relaxed">&ldquo;{ch.claim}&rdquo;</p>
                      </div>
                    </div>
                    <div className="pl-2 border-l-2 border-[#ff4444]/40">
                      <div className="text-xs text-[#ff4444] font-mono mb-1">RISK MANAGER CHALLENGE:</div>
                      <p className="text-gray-300 text-xs leading-relaxed">{ch.challenge}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Position Sizing + Risk/Reward + Stop Loss */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-amber-400" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Position Sizing</div>
          </div>
          <div className="space-y-3">
            {[
              { l: 'Recommended Size', v: position_sizing.recommended_size, color: 'text-amber-400' },
              { l: 'Kelly Criterion', v: position_sizing.kelly_criterion, color: 'text-white' },
              { l: 'Suggested (Conservative)', v: position_sizing.suggested_allocation, color: 'text-[#00ff88]' },
            ].map(({ l, v, color }) => (
              <div key={l}>
                <div className="text-xs text-gray-500 font-mono">{l}</div>
                <div className={`font-mono font-bold text-lg ${color}`}>{v}</div>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1e1e1e]">
              <div className="text-xs text-gray-500 font-mono mb-1">Rationale</div>
              <p className="text-gray-400 text-xs leading-relaxed">{position_sizing.rationale}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-[#00ff88]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Risk / Reward</div>
          </div>
          <div className="space-y-3">
            {[
              { l: 'Current Price', v: `$${risk_reward_analysis.current_price}`, color: 'text-white' },
              { l: 'Upside Target', v: `$${risk_reward_analysis.upside_target}`, color: 'text-[#00ff88]' },
              { l: 'Downside Target', v: `$${risk_reward_analysis.downside_target}`, color: 'text-[#ff4444]' },
              { l: 'R/R Ratio', v: risk_reward_analysis.risk_reward_ratio, color: 'text-amber-400' },
            ].map(({ l, v, color }) => (
              <div key={l} className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-mono">{l}</span>
                <span className={`font-mono font-bold ${color}`}>{v}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1e1e1e]">
              <div className="text-xs text-gray-500 font-mono mb-1">Assessment</div>
              <div className={`font-mono font-bold text-lg ${assessmentColor}`}>{risk_reward_analysis.assessment}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-[#ff4444]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Stop Levels</div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-amber-400 font-mono mb-1">SOFT STOP</div>
              <div className="font-mono text-3xl font-black text-white">${stop_loss_recommendation.soft_stop}</div>
              <div className="text-xs text-gray-500 mt-1">Reduce by 50% on close below</div>
            </div>
            <div>
              <div className="text-xs text-[#ff4444] font-mono mb-1">HARD STOP</div>
              <div className="font-mono text-3xl font-black text-[#ff4444]">${stop_loss_recommendation.hard_stop}</div>
              <div className="text-xs text-gray-500 mt-1">Exit 100% immediately</div>
            </div>
            <div className="pt-2 border-t border-[#ff4444]/20">
              <p className="text-gray-400 text-xs leading-relaxed">{stop_loss_recommendation.rationale}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Black Swan Risks */}
      <div className="bg-[#111] border border-[#ff4444]/20 rounded-lg p-5">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Black Swan Risks</div>
        <div className="grid grid-cols-1 gap-2">
          {risk_metrics.black_swan_risks.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-[#0d0d0d] rounded">
              <div className="text-[#ff4444] font-mono text-xs font-bold mt-0.5">☢</div>
              <p className="text-gray-400 text-xs leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Correlation Risk */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Correlation Risk</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {risk_metrics.correlation_risk.correlated_assets.map((a, i) => (
            <span key={i} className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs text-gray-400 font-mono">{a}</span>
          ))}
        </div>
        <p className="text-gray-400 text-xs leading-relaxed">{risk_metrics.correlation_risk.assessment}</p>
      </div>

      {/* Overall Assessment */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Overall Risk Assessment</div>
        <p className="text-gray-300 text-sm leading-relaxed">{data.overall_assessment}</p>
      </div>
    </div>
  )
}

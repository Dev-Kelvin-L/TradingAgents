export const dynamic = 'force-dynamic'

import { getRecommendationData, getRiskData } from '@/lib/data'
import { MessagesSquare, TrendingUp, TrendingDown, AlertTriangle, GitMerge } from 'lucide-react'

function DebateTypeBadge({ type }: { type: string }) {
  const configs: Record<string, { bg: string; text: string; border: string; label: string }> = {
    BULL: { bg: 'bg-[#00ff88]/10', text: 'text-[#00ff88]', border: 'border-[#00ff88]/30', label: 'BULL' },
    BEAR: { bg: 'bg-[#ff4444]/10', text: 'text-[#ff4444]', border: 'border-[#ff4444]/30', label: 'BEAR' },
    CHALLENGE: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', label: 'CHALLENGE' },
    SYNTHESIS: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'SYNTHESIS' },
  }
  const c = configs[type] || configs.BULL
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-mono font-bold ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  )
}

function DebateIcon({ type }: { type: string }) {
  const props = { className: 'h-5 w-5 flex-shrink-0 mt-0.5' }
  if (type === 'BULL') return <TrendingUp {...props} className="h-5 w-5 flex-shrink-0 mt-0.5 text-[#00ff88]" />
  if (type === 'BEAR') return <TrendingDown {...props} className="h-5 w-5 flex-shrink-0 mt-0.5 text-[#ff4444]" />
  if (type === 'CHALLENGE') return <AlertTriangle {...props} className="h-5 w-5 flex-shrink-0 mt-0.5 text-orange-400" />
  return <GitMerge {...props} className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-400" />
}

function debateBorderColor(type: string) {
  const map: Record<string, string> = {
    BULL: 'border-l-[#00ff88]',
    BEAR: 'border-l-[#ff4444]',
    CHALLENGE: 'border-l-orange-400',
    SYNTHESIS: 'border-l-blue-400',
  }
  return map[type] || 'border-l-gray-600'
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

export default async function DebatePage() {
  const [rec, risk] = await Promise.all([getRecommendationData(), getRiskData()])
  const { debate_log, execution_plan } = rec
  const { challenges } = risk

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessagesSquare className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Analyst Debate Log</h1>
            <p className="text-gray-500 text-sm">Multi-Agent Deliberation · {rec.ticker} · {new Date(rec.timestamp).toISOString().slice(0, 10)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['BULL', 'BEAR', 'CHALLENGE', 'SYNTHESIS'].map((t) => (
            <DebateTypeBadge key={t} type={t} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Debate Participants</div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { name: 'Fundamental Analyst', role: 'Fundamental research, valuation', color: 'text-[#00ff88]' },
            { name: 'Technical Analyst', role: 'Price action, chart patterns', color: 'text-amber-400' },
            { name: 'Sentiment Analyst', role: 'News, social media, flow', color: 'text-purple-400' },
            { name: 'Risk Manager', role: 'Risk assessment, challenges', color: 'text-[#ff4444]' },
          ].map(({ name, role, color }) => (
            <div key={name}>
              <div className={`font-semibold text-sm ${color}`}>{name}</div>
              <div className="text-xs text-gray-500">{role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Debate Timeline */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4">Deliberation Log</h2>
        <div className="space-y-4">
          {debate_log.map((entry, i) => (
            <div key={i} className={`bg-[#111] border border-[#1e1e1e] rounded-lg p-5 border-l-4 ${debateBorderColor(entry.type)}`}>
              <div className="flex items-center gap-3 mb-3">
                <DebateIcon type={entry.type} />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold">{entry.speaker}</span>
                    <DebateTypeBadge type={entry.type} />
                    <span className="text-gray-600 font-mono text-xs">Round {entry.round}</span>
                  </div>
                </div>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{entry.argument}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Manager's Detailed Challenges */}
      <div>
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4">Risk Manager — Detailed Challenges</h2>
        <div className="space-y-6">
          {[
            { title: 'Fundamental Analysis Challenges', items: challenges.fundamental_challenges },
            { title: 'Technical Analysis Challenges', items: challenges.technical_challenges },
            { title: 'Sentiment Analysis Challenges', items: challenges.sentiment_challenges },
          ].map(({ title, items }) => (
            <div key={title} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
              <div className="text-sm font-mono text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                {title}
              </div>
              <div className="space-y-5">
                {items.map((ch, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <SeverityBadge level={ch.severity} />
                      <div className="flex-1">
                        <div className="text-xs text-[#00ff88] font-mono mb-1">ANALYST POSITION:</div>
                        <p className="text-gray-400 text-sm italic leading-relaxed">&ldquo;{ch.claim}&rdquo;</p>
                      </div>
                    </div>
                    <div className="pl-4 border-l-2 border-[#ff4444]/40 ml-2">
                      <div className="text-xs text-[#ff4444] font-mono mb-1">RISK MANAGER REBUTTAL:</div>
                      <p className="text-gray-300 text-sm leading-relaxed">{ch.challenge}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Decision */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitMerge className="h-5 w-5 text-blue-400" />
          <div className="text-blue-400 font-mono text-sm uppercase tracking-widest">Lead Coordinator — Final Synthesis</div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">FINAL SIGNAL</div>
            <div className={`text-3xl font-mono font-black ${rec.signal === 'BUY' ? 'text-[#00ff88]' : rec.signal === 'SELL' ? 'text-[#ff4444]' : 'text-amber-400'}`}>{rec.signal}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">CONVICTION</div>
            <div className={`text-3xl font-mono font-black ${rec.conviction === 'HIGH' ? 'text-[#00ff88]' : rec.conviction === 'MEDIUM' ? 'text-amber-400' : 'text-[#ff4444]'}`}>{rec.conviction}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">CONFIDENCE</div>
            <div className="text-3xl font-mono font-black text-white">{rec.overall_confidence_score}/10</div>
          </div>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{rec.final_summary}</p>
      </div>

      {/* Execution Plan */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-6">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Execution Plan</div>
        <div className="space-y-5">
          {[
            { phase: 'Phase 1 — Entry', content: execution_plan.phase_1_entry, color: 'text-[#00ff88]' },
            { phase: 'Phase 2 — Position Management', content: execution_plan.phase_2_management, color: 'text-amber-400' },
            { phase: 'Phase 3 — Exit Strategy', content: execution_plan.phase_3_exit, color: 'text-blue-400' },
          ].map(({ phase, content, color }) => (
            <div key={phase}>
              <div className={`text-xs font-mono uppercase tracking-wider mb-1 ${color}`}>{phase}</div>
              <p className="text-gray-300 text-sm leading-relaxed">{content}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-[#1e1e1e]">
          <div className="text-xs text-[#ff4444] font-mono uppercase tracking-wider mb-2">Invalidation Conditions — Exit Immediately If:</div>
          <ul className="space-y-2">
            {execution_plan.invalidation_conditions.map((cond, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 text-[#ff4444] mt-1 flex-shrink-0" />
                <span className="text-gray-400 text-xs leading-relaxed">{cond}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Deciding Factors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-sm font-mono text-white uppercase tracking-widest mb-3">Deciding Factors</div>
          <ul className="space-y-2">
            {rec.rationale.deciding_factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                <span className="text-gray-400 text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-sm font-mono text-white uppercase tracking-widest mb-3">Key Risks Accepted</div>
          <ul className="space-y-2">
            {rec.rationale.key_risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#ff4444] mt-2 flex-shrink-0" />
                <span className="text-gray-400 text-sm">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { getSentimentData } from '@/lib/data'
import { MessageSquare, TrendingUp, TrendingDown, Building2, Globe } from 'lucide-react'
import { RatingsChart, SentimentMeter } from '@/components/SentimentCharts'

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

function ImpactBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: 'text-[#ff4444] bg-[#ff4444]/10 border-[#ff4444]/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    LOW: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${colors[level] || colors.LOW}`}>
      {level}
    </span>
  )
}

export default async function SentimentPage() {
  const data = await getSentimentData()
  const { analyst_ratings, social_media, institutional_flow, sector_momentum } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Sentiment Analysis</h1>
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

      {/* Sentiment Score + Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Overall Sentiment Score</div>
          <div className="text-center mb-4">
            <div className="text-6xl font-mono font-black text-[#00ff88]">
              {data.overall_sentiment_score > 0 ? '+' : ''}{data.overall_sentiment_score}
            </div>
            <div className="text-gray-500 font-mono text-sm">out of ±100</div>
          </div>
          <SentimentMeter score={data.overall_sentiment_score} />
        </div>
        <div className="col-span-2 bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Executive Summary</div>
          <p className="text-gray-300 leading-relaxed">{data.summary}</p>
        </div>
      </div>

      {/* News Headlines */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">News Headlines</div>
        <div className="space-y-3">
          {data.news_headlines.map((h, i) => (
            <div key={i} className={`border rounded-lg p-4 ${h.sentiment === 'BULLISH' ? 'border-[#00ff88]/15 bg-[#00ff88]/3' : h.sentiment === 'BEARISH' ? 'border-[#ff4444]/15 bg-[#ff4444]/3' : 'border-[#1e1e1e]'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold text-white text-sm leading-tight flex-1">{h.headline}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <SignalBadge signal={h.sentiment} />
                  <ImpactBadge level={h.impact} />
                </div>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[#00ff88] text-xs font-mono">{h.source}</span>
                <span className="text-gray-600 text-xs font-mono">{h.date}</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{h.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Analyst Ratings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-[#00ff88]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Wall Street Ratings</div>
          </div>
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-mono mb-1">Consensus</div>
            <div className="text-xl font-mono font-bold text-[#00ff88]">{analyst_ratings.consensus}</div>
          </div>
          <RatingsChart buy={analyst_ratings.buy_count} hold={analyst_ratings.hold_count} sell={analyst_ratings.sell_count} />
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { l: 'Buy', v: analyst_ratings.buy_count, color: 'text-[#00ff88]' },
              { l: 'Hold', v: analyst_ratings.hold_count, color: 'text-amber-400' },
              { l: 'Sell', v: analyst_ratings.sell_count, color: 'text-[#ff4444]' },
            ].map(({ l, v, color }) => (
              <div key={l} className="text-center bg-[#0d0d0d] rounded p-2">
                <div className={`font-mono text-2xl font-bold ${color}`}>{v}</div>
                <div className="text-xs text-gray-500 font-mono">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#1e1e1e]">
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div><div className="text-gray-500">Avg Target</div><div className="text-white font-bold">${analyst_ratings.average_target.toFixed(0)}</div></div>
              <div><div className="text-gray-500">High</div><div className="text-[#00ff88] font-bold">${analyst_ratings.high_target.toFixed(0)}</div></div>
              <div><div className="text-gray-500">Low</div><div className="text-[#ff4444] font-bold">${analyst_ratings.low_target.toFixed(0)}</div></div>
            </div>
          </div>
        </div>

        {/* Recent Rating Changes */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Recent Rating Changes</div>
          <div className="space-y-3">
            {analyst_ratings.recent_changes.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#0d0d0d] rounded-lg">
                <div>
                  <div className="text-white font-semibold text-sm">{c.firm}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{c.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono">
                    <span className="text-gray-500">{c.from}</span>
                    <span className="text-gray-600 mx-1">→</span>
                    <span className="text-[#00ff88] font-bold">{c.to}</span>
                  </div>
                  <div className="text-xs text-amber-400 font-mono">{c.target_change}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Media + Institutional Flow */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-[#00ff88]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">Social Media Sentiment</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { l: 'Reddit', v: social_media.reddit_sentiment },
              { l: 'Twitter/X', v: social_media.twitter_sentiment },
              { l: 'Retail Interest', v: social_media.retail_interest },
            ].map(({ l, v }) => (
              <div key={l} className="bg-[#0d0d0d] rounded p-3">
                <div className="text-xs text-gray-500 font-mono mb-1">{l}</div>
                <SignalBadge signal={v} />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <div className="text-xs text-gray-500 font-mono mb-2">Trending Topics</div>
            <div className="flex flex-wrap gap-2">
              {social_media.trending_topics.map((t, i) => (
                <span key={i} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs text-gray-400 font-mono">{t}</span>
              ))}
            </div>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">{social_media.assessment}</p>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Institutional Flow</div>
          <div className="space-y-3 mb-4">
            {[
              { l: 'Net Flow', v: institutional_flow.net_flow },
              { l: 'Options Sentiment', v: institutional_flow.options_sentiment },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between items-center p-3 bg-[#0d0d0d] rounded">
                <span className="text-gray-400 text-sm font-mono">{l}</span>
                <SignalBadge signal={v === 'INFLOW' ? 'BULLISH' : v === 'OUTFLOW' ? 'BEARISH' : v} />
              </div>
            ))}
            {[
              { l: 'Put/Call Ratio', v: institutional_flow.put_call_ratio.toString(), color: 'text-[#00ff88]' },
              { l: 'Short Interest', v: institutional_flow.short_interest, color: 'text-amber-400' },
            ].map(({ l, v, color }) => (
              <div key={l} className="flex justify-between items-center p-3 bg-[#0d0d0d] rounded">
                <span className="text-gray-400 text-sm font-mono">{l}</span>
                <span className={`font-mono font-bold text-sm ${color}`}>{v}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-mono mb-1">Dark Pool Activity</div>
          <p className="text-gray-400 text-xs leading-relaxed">{institutional_flow.dark_pool_activity}</p>
        </div>
      </div>

      {/* Upcoming Catalysts */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Upcoming Catalysts</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                {['Event', 'Date', 'Expected Impact', 'Magnitude'].map((h) => (
                  <th key={h} className="text-left text-xs font-mono text-gray-500 uppercase pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {data.upcoming_catalysts.map((c, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4 text-gray-300 text-xs">{c.event}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-400">{c.date}</td>
                  <td className="py-3 pr-4"><SignalBadge signal={c.expected_impact} /></td>
                  <td className="py-3"><ImpactBadge level={c.magnitude} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Momentum */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[#00ff88]" />
          <div className="text-sm font-mono text-white uppercase tracking-widest">Sector Momentum — {sector_momentum.sector}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { l: 'Sector Trend', v: sector_momentum.sector_trend },
            { l: `${data.ticker} vs Sector`, v: sector_momentum.nvda_vs_sector === 'OUTPERFORMING' ? 'BULLISH' : sector_momentum.nvda_vs_sector === 'UNDERPERFORMING' ? 'BEARISH' : 'NEUTRAL' },
          ].map(({ l, v }) => (
            <div key={l} className="bg-[#0d0d0d] rounded p-3">
              <div className="text-xs text-gray-500 font-mono mb-2">{l}</div>
              <SignalBadge signal={v} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-mono mb-2">Macro Tailwinds</div>
            <ul className="space-y-1">
              {sector_momentum.macro_tailwinds.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <TrendingUp className="h-3 w-3 text-[#00ff88] mt-0.5 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-mono mb-2">Macro Headwinds</div>
            <ul className="space-y-1">
              {sector_momentum.macro_headwinds.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <TrendingDown className="h-3 w-3 text-[#ff4444] mt-0.5 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bull / Bear */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-5">
          <div className="text-[#00ff88] font-mono text-xs uppercase tracking-widest mb-2">Bull Case</div>
          <p className="text-gray-300 text-sm leading-relaxed">{data.bull_case}</p>
        </div>
        <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-5">
          <div className="text-[#ff4444] font-mono text-xs uppercase tracking-widest mb-2">Bear Case</div>
          <p className="text-gray-300 text-sm leading-relaxed">{data.bear_case}</p>
        </div>
      </div>
    </div>
  )
}

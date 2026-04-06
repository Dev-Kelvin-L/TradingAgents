export const dynamic = 'force-dynamic'

import { getTechnicalData } from '@/lib/data'
import { TrendingUp, TrendingDown, Target, Activity } from 'lucide-react'
import PriceChart from '@/components/PriceChart'

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

function StrengthDot({ strength }: { strength: string }) {
  const color = strength === 'STRONG' ? 'bg-[#00ff88]' : strength === 'MODERATE' ? 'bg-amber-400' : 'bg-[#ff4444]'
  return <div className={`h-2 w-2 rounded-full ${color} flex-shrink-0`} />
}

export default async function TechnicalPage() {
  const data = await getTechnicalData()
  const { price_levels, moving_averages, indicators } = data

  const strongestSupport = price_levels.support_levels[0]
  const strongestResistance = price_levels.resistance_levels[0]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Technical Analysis</h1>
            <p className="text-gray-500 text-sm">{data.analyst} · {data.ticker}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono">Current Price</div>
            <div className="font-mono text-2xl font-bold text-white">${data.current_price.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono">Confidence</div>
            <div className="font-mono text-2xl font-bold text-white">{data.confidence_score}/10</div>
          </div>
          <SignalBadge signal={data.signal} />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Technical Summary</div>
        <p className="text-gray-300 leading-relaxed">{data.summary}</p>
      </div>

      {/* Price Chart */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#00ff88]" />
            <div className="text-sm font-mono text-white uppercase tracking-widest">30-Day Price History</div>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-gray-500">52W High: <span className="text-white">${price_levels.week_52_high}</span></span>
            <span className="text-gray-500">52W Low: <span className="text-white">${price_levels.week_52_low}</span></span>
          </div>
        </div>
        <PriceChart
          data={data.price_history}
          support={strongestSupport.level}
          resistance={strongestResistance.level}
          ma50={moving_averages.ma_50.value}
          ma200={moving_averages.ma_200.value}
        />
        <div className="flex gap-4 mt-3 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-[#00ff88]" /><span className="text-gray-500">Price</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-[#00ff88] opacity-50" style={{borderTop: '2px dashed #00ff88'}} /><span className="text-gray-500">Support ${strongestSupport.level}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-[#ff4444]">---</span><span className="text-gray-500">Resistance ${strongestResistance.level}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-amber-400">---</span><span className="text-gray-500">MA50 ${moving_averages.ma_50.value}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-purple-400">---</span><span className="text-gray-500">MA200 ${moving_averages.ma_200.value}</span></div>
        </div>
      </div>

      {/* Support / Resistance + Moving Averages */}
      <div className="grid grid-cols-2 gap-4">
        {/* Support / Resistance */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Price Levels</div>
          <div className="space-y-3">
            <div className="text-xs text-gray-500 font-mono uppercase">Resistance</div>
            {price_levels.resistance_levels.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <StrengthDot strength={r.strength} />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-[#ff4444] font-mono text-sm font-bold">${r.level}</span>
                    <span className="text-xs text-gray-600 font-mono">{r.strength}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{r.description}</p>
                </div>
              </div>
            ))}
            <div className="border-t border-[#1e1e1e] pt-3">
              <div className="text-xs text-gray-500 font-mono uppercase mb-2">Support</div>
              {price_levels.support_levels.map((s, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <StrengthDot strength={s.strength} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-[#00ff88] font-mono text-sm font-bold">${s.level}</span>
                      <span className="text-xs text-gray-600 font-mono">{s.strength}</span>
                    </div>
                    <p className="text-gray-500 text-xs">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Moving Averages + Indicators */}
        <div className="space-y-3">
          {/* MAs */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
            <div className="text-sm font-mono text-white uppercase tracking-widest mb-3">Moving Averages</div>
            <div className="space-y-3">
              {[
                { label: 'MA 50', ma: moving_averages.ma_50, color: 'text-amber-400' },
                { label: 'MA 200', ma: moving_averages.ma_200, color: 'text-purple-400' },
              ].map(({ label, ma, color }) => (
                <div key={label} className="flex items-center justify-between p-2 bg-[#0d0d0d] rounded">
                  <div>
                    <div className={`font-mono text-sm font-bold ${color}`}>{label}: ${ma.value}</div>
                    <div className="text-xs text-gray-500">{ma.assessment.slice(0, 50)}...</div>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${ma.price_relation === 'ABOVE' ? 'text-[#00ff88] bg-[#00ff88]/10' : 'text-[#ff4444] bg-[#ff4444]/10'}`}>
                    {ma.price_relation}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between p-2 bg-[#0d0d0d] rounded">
                <span className="text-gray-400 text-sm">Golden Cross</span>
                <span className={`font-mono text-sm font-bold ${moving_averages.golden_cross ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                  {moving_averages.golden_cross ? 'YES ✓' : 'NO ✗'}
                </span>
              </div>
            </div>
          </div>

          {/* RSI */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
            <div className="text-xs text-gray-500 font-mono uppercase mb-2">RSI (14)</div>
            <div className="flex items-center gap-3 mb-2">
              <div className="font-mono text-3xl font-bold text-white">{indicators.rsi_14.value}</div>
              <SignalBadge signal={
                indicators.rsi_14.condition === 'OVERBOUGHT' ? 'BEARISH' :
                indicators.rsi_14.condition === 'OVERSOLD' ? 'BULLISH' : 'NEUTRAL'
              } />
            </div>
            <div className="relative h-2 bg-[#1a1a1a] rounded-full mb-1">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff4444] via-amber-400 to-[#00ff88] rounded-full w-full opacity-30" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#0a0a0a] shadow"
                style={{ left: `calc(${indicators.rsi_14.value}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-gray-600">
              <span>Oversold 30</span><span>Neutral 50</span><span>Overbought 70</span>
            </div>
          </div>
        </div>
      </div>

      {/* MACD + Bollinger + Volume */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-mono uppercase mb-3">MACD</div>
          <div className="space-y-2">
            {[
              { l: 'MACD', v: indicators.macd.value.toFixed(2), color: 'text-white' },
              { l: 'Signal', v: indicators.macd.signal.toFixed(2), color: 'text-amber-400' },
              { l: 'Histogram', v: indicators.macd.histogram.toFixed(2), color: indicators.macd.histogram > 0 ? 'text-[#00ff88]' : 'text-[#ff4444]' },
            ].map(({ l, v, color }) => (
              <div key={l} className="flex justify-between">
                <span className="text-gray-500 text-xs font-mono">{l}</span>
                <span className={`font-mono text-sm font-bold ${color}`}>{v}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1e1e1e]">
              <SignalBadge signal={indicators.macd.trend} />
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-mono uppercase mb-3">Bollinger Bands</div>
          <div className="space-y-2">
            {[
              { l: 'Upper', v: `$${indicators.bollinger_bands.upper}`, color: 'text-[#ff4444]' },
              { l: 'Middle', v: `$${indicators.bollinger_bands.middle}`, color: 'text-white' },
              { l: 'Lower', v: `$${indicators.bollinger_bands.lower}`, color: 'text-[#00ff88]' },
            ].map(({ l, v, color }) => (
              <div key={l} className="flex justify-between">
                <span className="text-gray-500 text-xs font-mono">{l}</span>
                <span className={`font-mono text-sm font-bold ${color}`}>{v}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1e1e1e]">
              <div className="text-xs text-gray-500">{indicators.bollinger_bands.position}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-mono uppercase mb-3">Volume + ATR</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs font-mono">Trend</span>
              <span className={`font-mono text-sm font-bold ${indicators.volume_trend.condition === 'INCREASING' ? 'text-[#00ff88]' : indicators.volume_trend.condition === 'DECREASING' ? 'text-[#ff4444]' : 'text-amber-400'}`}>
                {indicators.volume_trend.condition}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs font-mono">vs Avg</span>
              <span className="font-mono text-xs text-gray-400">{indicators.volume_trend.vs_avg.slice(0, 20)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#1e1e1e]">
              <span className="text-gray-500 text-xs font-mono">ATR (14)</span>
              <span className="font-mono text-sm font-bold text-white">${indicators.atr_14.value}</span>
            </div>
            <div className="text-xs text-gray-600">{indicators.atr_14.assessment.slice(0, 60)}...</div>
          </div>
        </div>
      </div>

      {/* Chart Patterns */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="text-sm font-mono text-white uppercase tracking-widest mb-4">Chart Patterns</div>
        <div className="grid grid-cols-2 gap-4">
          {data.chart_patterns.map((p, i) => (
            <div key={i} className={`border rounded-lg p-4 ${p.type === 'BULLISH' ? 'border-[#00ff88]/20 bg-[#00ff88]/5' : p.type === 'BEARISH' ? 'border-[#ff4444]/20 bg-[#ff4444]/5' : 'border-[#1e1e1e]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold text-sm">{p.pattern}</span>
                <div className="flex gap-1">
                  <SignalBadge signal={p.type} />
                </div>
              </div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-gray-500">Target: <span className="text-white">${p.target}</span></span>
                <span className="text-gray-500">Reliability: <span className={p.reliability === 'HIGH' ? 'text-[#00ff88]' : p.reliability === 'MEDIUM' ? 'text-amber-400' : 'text-[#ff4444]'}>{p.reliability}</span></span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entry / Stop / Targets */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-[#00ff88]" />
            <div className="text-[#00ff88] font-mono text-xs uppercase tracking-widest">Entry Zone</div>
          </div>
          <div className="font-mono text-2xl font-bold text-white">${data.entry_zone.low} – ${data.entry_zone.high}</div>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">{data.entry_zone.rationale}</p>
        </div>
        <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-[#ff4444]" />
            <div className="text-[#ff4444] font-mono text-xs uppercase tracking-widest">Stop Loss</div>
          </div>
          <div className="font-mono text-2xl font-bold text-white">${data.stop_loss.price}</div>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">{data.stop_loss.rationale}</p>
        </div>
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <div className="text-amber-400 font-mono text-xs uppercase tracking-widest">Price Targets</div>
          </div>
          <div className="space-y-2">
            {data.targets.map((t, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-mono text-white font-bold">T{i + 1}: ${t.target}</span>
                <span className="text-xs text-gray-500 font-mono">{t.probability}</span>
              </div>
            ))}
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

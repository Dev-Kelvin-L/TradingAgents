'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, RefreshCw, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

const POPULAR_TICKERS = [
  'NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'GOOGL', 'AMZN',
  'AMD', 'PLTR', 'COIN', 'MSTR', 'SPY', 'QQQ', 'SMH', 'ARM',
  'AVGO', 'NFLX', 'UBER', 'SHOP', 'SQ'
]

const PERIODS = [
  { label: '1 Month', value: '1mo' },
  { label: '3 Months', value: '3mo' },
  { label: '6 Months', value: '6mo' },
  { label: '1 Year', value: '1y' },
  { label: '2 Years', value: '2y' },
]

export default function AnalysisControls() {
  const router = useRouter()
  const [ticker, setTicker] = useState('NVDA')
  const [customTicker, setCustomTicker] = useState('')
  const [period, setPeriod] = useState('6mo')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentTicker, setCurrentTicker] = useState('NVDA')

  // Load current ticker from analysis_status on mount
  useEffect(() => {
    fetch('/api/analysis-status')
      .then(r => r.json())
      .then(d => {
        if (d.ticker) { setCurrentTicker(d.ticker); setTicker(d.ticker) }
        if (d.period) setPeriod(d.period)
      })
      .catch(() => {})
  }, [])

  const pollStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/analysis-status')
      const d = await r.json()
      if (d.logs?.length) setLogs(d.logs)
      if (d.progress) setProgress(d.progress)
    } catch {}
  }, [])

  const handleRun = async () => {
    const targetTicker = (customTicker || ticker).toUpperCase().trim()
    if (!targetTicker) return

    setRunning(true)
    setProgress(0)
    setLogs([`Starting analysis for ${targetTicker} (${period})...`])
    setError(null)

    const interval = setInterval(pollStatus, 2000)

    try {
      const res = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: targetTicker, period }),
      })
      clearInterval(interval)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
        setLogs(prev => [...prev, ...(data.logs || [])])
      } else {
        setProgress(100)
        setCurrentTicker(targetTicker)
        setLogs(prev => [...prev, '✓ Analysis complete — refreshing dashboard...'])
        setTimeout(() => {
          router.refresh()
          setRunning(false)
        }, 1200)
        return
      }
    } catch {
      clearInterval(interval)
      setError('Network error')
    }
    setRunning(false)
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Analysis Controls</div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <div className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
          <span className="text-gray-500">Active:</span>
          <span className="text-[#00ff88]">{currentTicker}</span>
        </div>
      </div>

      {/* Ticker selection */}
      <div>
        <div className="text-xs font-mono text-gray-600 mb-2">Ticker</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {POPULAR_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); setCustomTicker('') }}
              disabled={running}
              className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors ${
                ticker === t && !customTicker
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                  : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300 hover:border-[#333]'
              } disabled:opacity-40`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-600" />
            <input
              type="text"
              value={customTicker}
              onChange={e => setCustomTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleRun()}
              placeholder="Custom ticker..."
              disabled={running}
              maxLength={10}
              className="w-full pl-7 pr-3 py-1.5 bg-[#111] border border-[#222] rounded text-xs font-mono text-white placeholder-gray-700 focus:outline-none focus:border-[#00ff88]/30 disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Period selection */}
      <div>
        <div className="text-xs font-mono text-gray-600 mb-2">Lookback Period</div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              disabled={running}
              className={`flex-1 py-1 text-xs font-mono rounded border transition-colors ${
                period === p.value
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                  : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300 hover:border-[#333]'
              } disabled:opacity-40`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="w-full bg-[#1a1a1a] rounded-full h-0.5">
          <div
            className="h-0.5 rounded-full bg-[#00ff88] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || (!ticker && !customTicker)}
        className="w-full flex items-center justify-center gap-2 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-sm font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {running
          ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing {customTicker || ticker}... {progress}%</>
          : <><Play className="h-4 w-4" /> Analyze {customTicker || ticker}</>
        }
      </button>

      {/* Logs */}
      {(logs.length > 0 || error) && (
        <div className="bg-[#080808] border border-[#161616] rounded p-2.5 max-h-36 overflow-y-auto space-y-0.5">
          {error && <div className="text-[#ff4444] text-xs font-mono">{error}</div>}
          {logs.map((l, i) => (
            <div key={i} className={`text-xs font-mono leading-relaxed ${
              l.includes('ERROR') ? 'text-[#ff4444]' :
              l.includes('✓') || l.includes('COMPLETE') ? 'text-[#00ff88]' :
              l.includes('Fetching') || l.includes('Wrote') ? 'text-gray-400' :
              'text-gray-600'
            }`}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}

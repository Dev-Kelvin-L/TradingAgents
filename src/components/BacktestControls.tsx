'use client'

import { useState } from 'react'
import { Play, RotateCcw, Plus, X } from 'lucide-react'

const PRESET_TICKERS = [
  'NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN',
  'SPY', 'QQQ', 'SMH', 'COIN', 'PLTR', 'MSTR', 'MARA',
  'INTC', 'NFLX', 'DIS', 'BABA', 'UBER', 'SHOP', 'SQ', 'ROKU',
  'ARM', 'SMCI', 'AVGO', 'QCOM', 'MU', 'ASML', 'TSM'
]

const PRESET_RANGES = [
  { label: '6 Months', value: '6mo' },
  { label: '1 Year', value: '1y' },
  { label: '2 Years', value: '2y' },
  { label: '3 Years', value: '3y' },
  { label: '5 Years', value: '5y' },
  { label: 'Custom', value: 'custom' },
]

interface Props {
  onComplete: () => void
}

export default function BacktestControls({ onComplete }: Props) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['NVDA', 'TSLA', 'MSFT', 'COIN'])
  const [customTicker, setCustomTicker] = useState('')
  const [rangePreset, setRangePreset] = useState('2y')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const toggleTicker = (t: string) => {
    setSelectedTickers(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const addCustomTicker = () => {
    const t = customTicker.toUpperCase().trim()
    if (t && !selectedTickers.includes(t)) {
      setSelectedTickers(prev => [...prev, t])
    }
    setCustomTicker('')
  }

  const handleRun = async () => {
    if (selectedTickers.length === 0) return
    setRunning(true)
    setLogs([`Starting backtest for ${selectedTickers.join(', ')}...`])
    setError(null)
    setProgress(0)

    const body: Record<string, unknown> = { tickers: selectedTickers, period: rangePreset }
    if (rangePreset === 'custom' && startDate && endDate) {
      body.startDate = startDate
      body.endDate = endDate
      delete body.period
    }

    // Poll progress while waiting
    let done = false
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/backtest-status')
        if (statusRes.ok) {
          const status = await statusRes.json()
          if (status.logs?.length) {
            setLogs(status.logs)
          }
          const completed = status.results?.length || 0
          const total = selectedTickers.length
          setProgress(Math.round((completed / total) * 100))
        }
      } catch {}
      if (done) clearInterval(pollInterval)
    }, 2000)

    try {
      const res = await fetch('/api/run-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      done = true
      clearInterval(pollInterval)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Backtest failed')
        setLogs(data.logs || [])
      } else {
        setLogs(data.logs || ['Complete!'])
        setProgress(100)
        onComplete()
      }
    } catch {
      done = true
      clearInterval(pollInterval)
      setError('Network error — is the dev server running?')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Backtest Controls</div>
        {running && (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Running... {progress}%
          </div>
        )}
      </div>

      {/* Ticker Selection */}
      <div>
        <div className="text-xs font-mono text-gray-400 mb-2">Select Tickers ({selectedTickers.length} selected)</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => toggleTicker(t)}
              disabled={running}
              className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                selectedTickers.includes(t)
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-gray-500 hover:text-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Custom ticker input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customTicker}
            onChange={e => setCustomTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addCustomTicker()}
            placeholder="Add custom ticker..."
            disabled={running}
            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#00ff88]/40 disabled:opacity-50"
          />
          <button
            onClick={addCustomTicker}
            disabled={running || !customTicker}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Selected tickers chips */}
        {selectedTickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedTickers.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded text-xs font-mono text-[#00ff88]">
                {t}
                <button onClick={() => toggleTicker(t)} disabled={running} className="hover:text-white disabled:opacity-50">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Date Range */}
      <div>
        <div className="text-xs font-mono text-gray-400 mb-2">Date Range</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRangePreset(r.value)}
              disabled={running}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                rangePreset === r.value
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-gray-500 hover:text-gray-300'
              } disabled:opacity-50`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {rangePreset === 'custom' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1 font-mono">Start Date</div>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={running}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00ff88]/40 disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1 font-mono">End Date</div>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={running}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00ff88]/40 disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="flex gap-3 items-center">
        <button
          onClick={handleRun}
          disabled={running || selectedTickers.length === 0}
          className="flex items-center gap-2 px-5 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-sm font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play className="h-4 w-4" />
          {running ? 'Running...' : `Run Backtest (${selectedTickers.length} ticker${selectedTickers.length !== 1 ? 's' : ''})`}
        </button>
        <button
          onClick={() => { setSelectedTickers([]); setLogs([]); setError(null) }}
          disabled={running}
          className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="w-full bg-[#1a1a1a] rounded-full h-1">
          <div
            className="h-1 rounded-full bg-[#00ff88] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Logs */}
      {(logs.length > 0 || error) && (
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded p-3 max-h-40 overflow-y-auto">
          {error && <div className="text-[#ff4444] text-xs font-mono mb-1">{error}</div>}
          {logs.map((l, i) => (
            <div key={i} className={`text-xs font-mono ${l.includes('ERROR') || l.includes('err]') ? 'text-[#ff4444]' : l.includes('BEATS') ? 'text-[#00ff88]' : l.includes('DONE') || l.includes('Complete') ? 'text-[#00ff88]' : 'text-gray-500'}`}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

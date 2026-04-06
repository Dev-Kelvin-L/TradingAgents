'use client'

import { useState } from 'react'
import { FlaskConical, RefreshCw, AlertTriangle } from 'lucide-react'

export default function RunBacktestButton({ ticker }: { ticker: string }) {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch('/api/run-single-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => window.location.reload(), 800)
      } else {
        const d = await res.json()
        setError(d.error || 'Backtest failed')
      }
    } catch {
      setError('Network error')
    }
    setRunning(false)
  }

  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
      <div className="flex-1 text-sm font-mono text-amber-400">
        Backtest data is for a different symbol. Run backtest for <span className="font-bold text-white">{ticker}</span>?
      </div>
      <button
        onClick={run}
        disabled={running || done}
        className="flex items-center gap-2 px-4 py-1.5 rounded border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88] text-xs font-mono font-bold hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
      >
        {running
          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Running...</>
          : done
          ? <><FlaskConical className="h-3.5 w-3.5" />Done — reloading</>
          : <><FlaskConical className="h-3.5 w-3.5" />Run Backtest</>
        }
      </button>
      {error && <span className="text-xs font-mono text-[#ff4444]">{error}</span>}
    </div>
  )
}

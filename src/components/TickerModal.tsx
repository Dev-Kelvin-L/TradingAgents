'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Activity, RefreshCw, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Category = 'All' | 'Stocks' | 'ETFs' | 'Crypto' | 'Forex'

interface Symbol {
  ticker: string
  name: string
  type: 'stock' | 'etf' | 'crypto' | 'forex'
  exchange: string
  color: string
}

const SYMBOLS: Symbol[] = [
  // Stocks
  { ticker: 'NVDA',  name: 'NVIDIA Corporation',            type: 'stock', exchange: 'NASDAQ', color: '#76b900' },
  { ticker: 'AAPL',  name: 'Apple Inc.',                    type: 'stock', exchange: 'NASDAQ', color: '#555' },
  { ticker: 'MSFT',  name: 'Microsoft Corporation',         type: 'stock', exchange: 'NASDAQ', color: '#00a4ef' },
  { ticker: 'TSLA',  name: 'Tesla, Inc.',                   type: 'stock', exchange: 'NASDAQ', color: '#cc0000' },
  { ticker: 'META',  name: 'Meta Platforms, Inc.',          type: 'stock', exchange: 'NASDAQ', color: '#0082fb' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',                 type: 'stock', exchange: 'NASDAQ', color: '#4285f4' },
  { ticker: 'AMZN',  name: 'Amazon.com, Inc.',              type: 'stock', exchange: 'NASDAQ', color: '#ff9900' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices',        type: 'stock', exchange: 'NASDAQ', color: '#ed1c24' },
  { ticker: 'PLTR',  name: 'Palantir Technologies Inc.',    type: 'stock', exchange: 'NASDAQ', color: '#1e1e1e' },
  { ticker: 'MSTR',  name: 'MicroStrategy Inc.',            type: 'stock', exchange: 'NASDAQ', color: '#f7931a' },
  { ticker: 'MARA',  name: 'Marathon Digital Holdings',     type: 'stock', exchange: 'NASDAQ', color: '#0099cc' },
  { ticker: 'ARM',   name: 'Arm Holdings plc',              type: 'stock', exchange: 'NASDAQ', color: '#0091bd' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',                 type: 'stock', exchange: 'NASDAQ', color: '#cc0000' },
  { ticker: 'QCOM',  name: 'Qualcomm Incorporated',         type: 'stock', exchange: 'NASDAQ', color: '#3253dc' },
  { ticker: 'INTC',  name: 'Intel Corporation',             type: 'stock', exchange: 'NASDAQ', color: '#0071c5' },
  { ticker: 'TSM',   name: 'Taiwan Semiconductor',          type: 'stock', exchange: 'NYSE',   color: '#1a73e8' },
  { ticker: 'ASML',  name: 'ASML Holding N.V.',             type: 'stock', exchange: 'NASDAQ', color: '#0032a0' },
  { ticker: 'MU',    name: 'Micron Technology, Inc.',       type: 'stock', exchange: 'NASDAQ', color: '#c8102e' },
  { ticker: 'SMCI',  name: 'Super Micro Computer',          type: 'stock', exchange: 'NASDAQ', color: '#003087' },
  { ticker: 'COIN',  name: 'Coinbase Global, Inc.',         type: 'stock', exchange: 'NASDAQ', color: '#0052ff' },
  { ticker: 'NFLX',  name: 'Netflix, Inc.',                 type: 'stock', exchange: 'NASDAQ', color: '#e50914' },
  { ticker: 'UBER',  name: 'Uber Technologies, Inc.',       type: 'stock', exchange: 'NYSE',   color: '#000000' },
  { ticker: 'SHOP',  name: 'Shopify Inc.',                  type: 'stock', exchange: 'NYSE',   color: '#96bf48' },
  { ticker: 'SQ',    name: 'Block, Inc.',                   type: 'stock', exchange: 'NYSE',   color: '#3e3e3e' },
  { ticker: 'BABA',  name: 'Alibaba Group Holding',         type: 'stock', exchange: 'NYSE',   color: '#ff6a00' },
  // ETFs
  { ticker: 'SPY',   name: 'SPDR S&P 500 ETF Trust',        type: 'etf',   exchange: 'AMEX',   color: '#c8102e' },
  { ticker: 'QQQ',   name: 'Invesco QQQ Trust',             type: 'etf',   exchange: 'NASDAQ', color: '#007dc5' },
  { ticker: 'SMH',   name: 'VanEck Semiconductor ETF',      type: 'etf',   exchange: 'AMEX',   color: '#006940' },
  { ticker: 'ARKK',  name: 'ARK Innovation ETF',            type: 'etf',   exchange: 'AMEX',   color: '#00b0f0' },
  { ticker: 'IWM',   name: 'iShares Russell 2000 ETF',      type: 'etf',   exchange: 'AMEX',   color: '#ffb400' },
  { ticker: 'GLD',   name: 'SPDR Gold Shares',              type: 'etf',   exchange: 'AMEX',   color: '#d4af37' },
  // Crypto
  { ticker: 'BTC-USD',  name: 'Bitcoin USD',                type: 'crypto', exchange: 'CRYPTO', color: '#f7931a' },
  { ticker: 'ETH-USD',  name: 'Ethereum USD',               type: 'crypto', exchange: 'CRYPTO', color: '#627eea' },
  { ticker: 'SOL-USD',  name: 'Solana USD',                 type: 'crypto', exchange: 'CRYPTO', color: '#9945ff' },
  { ticker: 'XRP-USD',  name: 'XRP USD',                    type: 'crypto', exchange: 'CRYPTO', color: '#346aa9' },
  { ticker: 'DOGE-USD', name: 'Dogecoin USD',               type: 'crypto', exchange: 'CRYPTO', color: '#c2a633' },
  // Forex
  { ticker: 'EURUSD=X', name: 'Euro / US Dollar',           type: 'forex', exchange: 'FX', color: '#003399' },
  { ticker: 'GBPUSD=X', name: 'British Pound / US Dollar',  type: 'forex', exchange: 'FX', color: '#012169' },
  { ticker: 'USDJPY=X', name: 'US Dollar / Japanese Yen',   type: 'forex', exchange: 'FX', color: '#bc002d' },
  { ticker: 'USDCAD=X', name: 'US Dollar / Canadian Dollar',type: 'forex', exchange: 'FX', color: '#d80621' },
  { ticker: 'AUDUSD=X', name: 'Australian Dollar / USD',    type: 'forex', exchange: 'FX', color: '#00008b' },
]

const TYPE_LABEL: Record<Symbol['type'], string> = {
  stock: 'stock',
  etf: 'fund',
  crypto: 'crypto',
  forex: 'forex',
}

const TYPE_COLOR: Record<Symbol['type'], string> = {
  stock:  'text-blue-400',
  etf:    'text-purple-400',
  crypto: 'text-amber-400',
  forex:  'text-green-400',
}

interface Props {
  currentPrice: number
  changeStr: string
  changeColor: string
  activeTicker: string
}

export default function TickerModal({ currentPrice, changeStr, changeColor, activeTicker }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('All')
  const [running, setRunning] = useState(false)
  const [runningTicker, setRunningTicker] = useState('')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setCategory('All'); setError(null); setLogs([]) }
  }, [open])

  const filtered = SYMBOLS.filter(s => {
    const matchCat =
      category === 'All' ||
      (category === 'Stocks' && s.type === 'stock') ||
      (category === 'ETFs'   && s.type === 'etf') ||
      (category === 'Crypto' && s.type === 'crypto') ||
      (category === 'Forex'  && s.type === 'forex')
    const q = query.toUpperCase()
    const matchQuery = !q || s.ticker.includes(q) || s.name.toUpperCase().includes(q)
    return matchCat && matchQuery
  })

  // Also add custom typed ticker if not in list
  const customMatch = query.length >= 1 && !SYMBOLS.find(s => s.ticker === query.toUpperCase())
  if (customMatch) {
    filtered.unshift({
      ticker: query.toUpperCase(),
      name: `Search "${query.toUpperCase()}"`,
      type: 'stock',
      exchange: 'Custom',
      color: '#555',
    })
  }

  const pollStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/analysis-status')
      const d = await r.json()
      if (d.logs?.length) setLogs(d.logs)
      if (typeof d.progress === 'number') setProgress(d.progress)
    } catch {}
  }, [])

  const handleSelect = async (symbol: Symbol) => {
    setRunningTicker(symbol.ticker)
    setRunning(true)
    setProgress(0)
    setLogs([`Starting analysis for ${symbol.ticker}...`])
    setError(null)

    const interval = setInterval(pollStatus, 2000)

    try {
      const res = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol.ticker, period: '6mo' }),
      })
      clearInterval(interval)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
      } else {
        setProgress(100)
        setLogs(prev => [...prev, '✓ Analysis complete — loading new data...'])
        setTimeout(() => {
          setOpen(false)
          setRunning(false)
          setLogs([])
          // Hard navigate to root to force all server components to re-render with new data
          window.location.href = '/'
        }, 1200)
        return
      }
    } catch {
      clearInterval(interval)
      setError('Network error')
    }
    setRunning(false)
  }

  const CATEGORIES: Category[] = ['All', 'Stocks', 'ETFs', 'Crypto', 'Forex']

  return (
    <>
      {/* Sidebar header — click to open */}
      <div
        onClick={() => !running && setOpen(true)}
        className="p-4 border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111] transition-colors group"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#00ff88]" />
            <span className="font-mono text-sm font-bold text-[#00ff88] tracking-widest">{activeTicker}</span>
          </div>
          <Search className="h-3.5 w-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
        <div className="font-mono text-xs text-gray-500">SWING TRADE TERMINAL</div>
        <div className="mt-2 font-mono text-lg font-bold text-white">${currentPrice.toFixed(2)}</div>
        <div className={`font-mono text-xs ${changeColor}`}>{changeStr}</div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => !running && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-[580px] max-h-[75vh] flex flex-col bg-[#131313] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
              <span className="text-base font-semibold text-white">Symbol Search</span>
              <button
                onClick={() => !running && setOpen(false)}
                disabled={running}
                className="p-1 rounded hover:bg-[#222] text-gray-500 hover:text-white transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search input */}
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <div className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
                <Search className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Symbol, name, or keyword..."
                  disabled={running}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none font-mono disabled:opacity-40"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-600 hover:text-gray-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 px-4 py-2.5 border-b border-[#1e1e1e]">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    category === cat
                      ? 'bg-[#2a2a2a] text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Running state */}
            {running && (
              <div className="px-4 py-3 border-b border-[#1e1e1e] bg-[#0d0d0d]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Analyzing {runningTicker}... {progress}%
                  </div>
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-0.5 mb-2">
                  <div className="h-0.5 rounded-full bg-[#00ff88] transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {logs.slice(-8).map((l, i) => (
                    <div key={i} className={`text-xs font-mono ${
                      l.includes('✓') || l.includes('COMPLETE') ? 'text-[#00ff88]' :
                      l.includes('ERROR') ? 'text-[#ff4444]' : 'text-gray-600'
                    }`}>{l}</div>
                  ))}
                </div>
                {error && <div className="text-xs font-mono text-[#ff4444] mt-1">{error}</div>}
              </div>
            )}

            {/* Results list */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-12 font-mono">No symbols found</div>
              ) : (
                filtered.map((s, i) => (
                  <button
                    key={`${s.ticker}-${i}`}
                    onClick={() => !running && handleSelect(s)}
                    disabled={running}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#1a1a1a] transition-colors border-b border-[#181818] last:border-0 disabled:opacity-40 group text-left"
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.ticker.charAt(0)}
                    </div>

                    {/* Ticker + name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-white group-hover:text-[#00ff88] transition-colors">
                        {s.ticker}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{s.name}</div>
                    </div>

                    {/* Type + Exchange */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-mono ${TYPE_COLOR[s.type]}`}>
                        {TYPE_LABEL[s.type]}
                      </span>
                      <span className="text-xs font-mono text-gray-600 bg-[#222] px-1.5 py-0.5 rounded">
                        {s.exchange}
                      </span>
                      <Play className="h-3.5 w-3.5 text-gray-700 group-hover:text-[#00ff88] transition-colors" />
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-[#1e1e1e] text-xs text-gray-700 font-mono text-center">
              Click a symbol to run analysis · Type any ticker to search
            </div>
          </div>
        </div>
      )}
    </>
  )
}

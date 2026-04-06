import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart2,
  TrendingUp,
  MessageSquare,
  Shield,
  MessagesSquare,
  Activity,
  FlaskConical,
  BarChart3,
} from 'lucide-react'
import { getTechnicalData, getRecommendationData } from '@/lib/data'
import TickerModal from '@/components/TickerModal'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Swing Trade Terminal',
  description: 'AI-powered swing trade analysis dashboard',
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fundamental', label: 'Fundamental', icon: BarChart2 },
  { href: '/technical', label: 'Technical', icon: TrendingUp },
  { href: '/sentiment', label: 'Sentiment', icon: MessageSquare },
  { href: '/risk', label: 'Risk', icon: Shield },
  { href: '/debate', label: 'Debate Log', icon: MessagesSquare },
  { href: '/trading', label: 'Trading', icon: Activity },
  { href: '/backtest', label: 'Backtest', icon: FlaskConical },
  { href: '/multi-backtest', label: 'Multi-Backtest', icon: BarChart3 },
]

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [tech, rec] = await Promise.all([getTechnicalData(), getRecommendationData()])
  const currentPrice = tech.current_price
  const history = tech.price_history
  const prevClose = history.length >= 2 ? history[history.length - 2].close : currentPrice
  const change = currentPrice - prevClose
  const changePct = (change / prevClose) * 100
  const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`
  const changeColor = change >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0a] text-gray-100 min-h-screen`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col">
            {/* Logo / Header — click to open ticker modal */}
            <TickerModal
              currentPrice={currentPrice}
              changeStr={changeStr}
              changeColor={changeColor}
              activeTicker={tech.ticker || rec.ticker || 'N/A'}
            />

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors group"
                  >
                    <Icon className="h-4 w-4 group-hover:text-[#00ff88] transition-colors" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-[#1a1a1a]">
              <div className="font-mono text-xs text-gray-600">Analysis Date</div>
              <div className="font-mono text-xs text-gray-400">{new Date(rec.timestamp).toISOString().slice(0, 10)}</div>
              <div className="mt-2 font-mono text-xs text-gray-600">Timeframe</div>
              <div className="font-mono text-xs text-gray-400">{rec.trade_parameters.timeframe}</div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

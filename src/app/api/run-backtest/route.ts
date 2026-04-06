import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300 // 5 minutes

export async function POST(req: NextRequest) {
  const body = await req.json()
  const tickers: string[] = body.tickers || ['NVDA']
  const startDate: string | null = body.startDate || null
  const endDate: string | null = body.endDate || null
  const period: string = body.period || '2y'

  // Validate tickers — only allow alphanumeric
  const safeTickers = tickers
    .map(t => t.toUpperCase().replace(/[^A-Z0-9.]/g, ''))
    .filter(t => t.length > 0 && t.length <= 10)

  if (safeTickers.length === 0) {
    return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'multi_backtest.py')
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: 'multi_backtest.py not found' }, { status: 500 })
  }

  // Write a "running" status to the JSON file immediately
  const dataPath = path.join(process.cwd(), 'data', 'multi_backtest.json')
  const runningStatus = {
    status: 'running',
    generated_at: new Date().toISOString(),
    config_used: { tickers_requested: safeTickers, start_date: startDate, end_date: endDate, period },
    results: [],
    summary: { tickers_tested: 0, beats_bh_count: 0, profitable_count: 0, best_ticker: null, best_alpha: null, worst_ticker: null, avg_alpha: 0, avg_sharpe: 0 },
    failed: [],
    logs: []
  }
  fs.writeFileSync(dataPath, JSON.stringify(runningStatus, null, 2))

  // Build args
  const args = ['multi_backtest.py', '--tickers', ...safeTickers, '--period', period]
  if (startDate && endDate) {
    args.push('--start', startDate, '--end', endDate)
  }

  return new Promise<NextResponse>((resolve) => {
    const logs: string[] = []
    const proc = spawn('python', args, { cwd: process.cwd() })

    proc.stdout.on('data', (data) => {
      const line = data.toString()
      logs.push(line.trim())
      // Update logs in JSON file as we go
      try {
        const current = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        current.logs = logs.slice(-50) // keep last 50 log lines
        fs.writeFileSync(dataPath, JSON.stringify(current, null, 2))
      } catch {}
    })

    proc.stderr.on('data', (data) => {
      logs.push(`[err] ${data.toString().trim()}`)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(NextResponse.json({ success: true, tickers: safeTickers, logs: logs.slice(-20) }))
      } else {
        // Mark as failed in JSON
        try {
          const current = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
          current.status = 'error'
          current.logs = logs.slice(-50)
          fs.writeFileSync(dataPath, JSON.stringify(current, null, 2))
        } catch {}
        resolve(NextResponse.json({ error: 'Backtest failed', code, logs: logs.slice(-20) }, { status: 500 }))
      }
    })

    proc.on('error', (err) => {
      resolve(NextResponse.json({ error: `Failed to start process: ${err.message}` }, { status: 500 }))
    })
  })
}

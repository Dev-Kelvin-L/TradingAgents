import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ticker = (body.ticker as string || 'NVDA').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 10)

  if (!ticker) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'backtest.py')
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: 'backtest.py not found' }, { status: 500 })
  }

  return new Promise<NextResponse>((resolve) => {
    const logs: string[] = []
    const proc = spawn('python', ['backtest.py', '--ticker', ticker, '--no-optimize'], {
      cwd: process.cwd(),
    })

    proc.stdout.on('data', (data) => {
      data.toString().split('\n').filter((l: string) => l.trim()).forEach((l: string) => logs.push(l))
    })
    proc.stderr.on('data', (data) => {
      data.toString().split('\n').filter((l: string) => l.trim() && !l.includes('DeprecationWarning')).forEach((l: string) => logs.push(l))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(NextResponse.json({ success: true, ticker, logs: logs.slice(-10) }))
      } else {
        resolve(NextResponse.json({ error: 'Backtest failed', logs: logs.slice(-10) }, { status: 500 }))
      }
    })

    proc.on('error', (err) => {
      resolve(NextResponse.json({ error: err.message }, { status: 500 }))
    })
  })
}

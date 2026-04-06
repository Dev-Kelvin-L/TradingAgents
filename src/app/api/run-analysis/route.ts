import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ticker = (body.ticker as string || 'NVDA').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 10)
  const period = (body.period as string || '6mo').replace(/[^a-z0-9]/g, '').slice(0, 5)

  if (!ticker) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'fetch_data.py')
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: 'fetch_data.py not found' }, { status: 500 })
  }

  // Write running status immediately
  const statusPath = path.join(process.cwd(), 'data', 'analysis_status.json')
  fs.writeFileSync(statusPath, JSON.stringify({
    status: 'running',
    ticker,
    period,
    started_at: new Date().toISOString(),
    logs: [],
    progress: 0
  }, null, 2))

  return new Promise<NextResponse>((resolve) => {
    const logs: string[] = []
    const proc = spawn('python', ['fetch_data.py', '--ticker', ticker, '--period', period], {
      cwd: process.cwd()
    })

    const updateStatus = (progress: number) => {
      try {
        fs.writeFileSync(statusPath, JSON.stringify({
          status: 'running',
          ticker,
          period,
          started_at: new Date().toISOString(),
          logs: logs.slice(-30),
          progress
        }, null, 2))
      } catch {}
    }

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      text.split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
        logs.push(line)
        // Rough progress tracking based on log content
        if (line.includes('[1/5]')) updateStatus(10)
        else if (line.includes('[2/5]')) updateStatus(30)
        else if (line.includes('[3/5]')) updateStatus(55)
        else if (line.includes('[4/5]')) updateStatus(75)
        else if (line.includes('[5/5]')) updateStatus(90)
        else if (line.includes('COMPLETE')) updateStatus(100)
        else updateStatus(logs.length * 2)
      })
    })

    proc.stderr.on('data', (data) => {
      data.toString().split('\n').filter((l: string) => l.trim() && !l.includes('DeprecationWarning') && !l.includes('timezone')).forEach((l: string) => logs.push(l))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        fs.writeFileSync(statusPath, JSON.stringify({
          status: 'complete',
          ticker,
          period,
          completed_at: new Date().toISOString(),
          logs: logs.slice(-30),
          progress: 100
        }, null, 2))
        resolve(NextResponse.json({ success: true, ticker, logs: logs.slice(-10) }))
      } else {
        fs.writeFileSync(statusPath, JSON.stringify({
          status: 'error',
          ticker,
          period,
          logs: logs.slice(-30),
          progress: 0
        }, null, 2))
        resolve(NextResponse.json({ error: 'Analysis failed', logs: logs.slice(-10) }, { status: 500 }))
      }
    })

    proc.on('error', (err) => {
      resolve(NextResponse.json({ error: err.message }, { status: 500 }))
    })
  })
}

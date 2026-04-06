import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const dataPath = path.join(process.cwd(), 'data', 'multi_backtest.json')
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(raw)
    return NextResponse.json({
      status: data.status || 'complete',
      results: data.results || [],
      logs: data.logs || [],
      summary: data.summary || {}
    })
  } catch {
    return NextResponse.json({ status: 'no_data', results: [], logs: [] })
  }
}

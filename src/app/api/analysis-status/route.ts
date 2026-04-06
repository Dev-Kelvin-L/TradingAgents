import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const statusPath = path.join(process.cwd(), 'data', 'analysis_status.json')
  try {
    const raw = fs.readFileSync(statusPath, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ status: 'idle', ticker: 'NVDA', period: '6mo', logs: [], progress: 0 })
  }
}

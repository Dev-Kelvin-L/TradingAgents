import fs from 'fs'
import path from 'path'
import type {
  FundamentalData,
  TechnicalData,
  SentimentData,
  RiskData,
  RecommendationData,
  BacktestData,
  MultiBacktestData,
} from '@/types/trading'

const dataDir = path.join(process.cwd(), 'data')

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(dataDir, filename)
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export async function getFundamentalData(): Promise<FundamentalData> {
  return readJsonFile<FundamentalData>('fundamental.json')
}

export async function getTechnicalData(): Promise<TechnicalData> {
  return readJsonFile<TechnicalData>('technical.json')
}

export async function getSentimentData(): Promise<SentimentData> {
  return readJsonFile<SentimentData>('sentiment.json')
}

export async function getRiskData(): Promise<RiskData> {
  return readJsonFile<RiskData>('risk.json')
}

export async function getRecommendationData(): Promise<RecommendationData> {
  return readJsonFile<RecommendationData>('recommendation.json')
}

export async function getBacktestData(): Promise<BacktestData> {
  const filePath = path.join(process.cwd(), 'data', 'backtest.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as BacktestData
}

export async function getMultiBacktestData(): Promise<MultiBacktestData> {
  const filePath = path.join(process.cwd(), 'data', 'multi_backtest.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as MultiBacktestData
}

// Shared types
export type SignalType = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type SeverityLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type StrengthLevel = 'STRONG' | 'MODERATE' | 'WEAK'
export type TrendType = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type PriceRelation = 'ABOVE' | 'BELOW'

// Fundamental Analysis Types
export interface FundamentalMetric {
  value: number | string
  industry_avg?: number
  trend?: string
  assessment: string
}

export interface InsiderTransaction {
  type: 'BUY' | 'SELL'
  executive: string
  shares: number
  date: string
  significance: string
}

export interface InsiderActivity {
  recent_transactions: InsiderTransaction[]
  net_sentiment: SignalType
  assessment: string
}

export interface Catalyst {
  catalyst: string
  impact: ImpactLevel
  timeframe: string
  description: string
}

export interface Risk {
  risk: string
  severity: SeverityLevel
  description: string
}

export interface FundamentalData {
  ticker: string
  analyst: string
  timestamp: string
  confidence_score: number
  signal: SignalType
  summary: string
  metrics: {
    pe_ratio: FundamentalMetric
    revenue_growth_yoy: FundamentalMetric
    earnings_growth_yoy: FundamentalMetric
    profit_margin: FundamentalMetric
    debt_to_equity: FundamentalMetric
    free_cash_flow: FundamentalMetric
    return_on_equity: FundamentalMetric
    current_ratio: FundamentalMetric
  }
  insider_activity: InsiderActivity
  catalysts: Catalyst[]
  risks: Risk[]
  bull_case: string
  bear_case: string
  reasoning: string
}

// Technical Analysis Types
export interface PriceLevel {
  level: number
  strength: StrengthLevel
  description: string
}

export interface MovingAverage {
  value: number
  price_relation: PriceRelation
  assessment: string
}

export interface RSIIndicator {
  value: number
  condition: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
  assessment: string
}

export interface MACDIndicator {
  value: number
  signal: number
  histogram: number
  trend: TrendType
  assessment: string
}

export interface BollingerBands {
  upper: number
  middle: number
  lower: number
  position: string
  assessment: string
}

export interface VolumeIndicator {
  condition: 'INCREASING' | 'DECREASING' | 'STABLE'
  vs_avg: string
  assessment: string
}

export interface ATRIndicator {
  value: number
  assessment: string
}

export interface ChartPattern {
  pattern: string
  type: TrendType
  reliability: 'HIGH' | 'MEDIUM' | 'LOW'
  target: number
  description: string
}

export interface PriceCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TradeTarget {
  target: number
  probability: string
  rationale: string
}

export interface TechnicalData {
  ticker: string
  analyst: string
  timestamp: string
  confidence_score: number
  signal: SignalType
  current_price: number
  summary: string
  price_levels: {
    current_price: number
    week_52_high: number
    week_52_low: number
    support_levels: PriceLevel[]
    resistance_levels: PriceLevel[]
  }
  moving_averages: {
    ma_50: MovingAverage
    ma_200: MovingAverage
    golden_cross: boolean
    assessment: string
  }
  indicators: {
    rsi_14: RSIIndicator
    macd: MACDIndicator
    bollinger_bands: BollingerBands
    volume_trend: VolumeIndicator
    atr_14: ATRIndicator
  }
  chart_patterns: ChartPattern[]
  price_history: PriceCandle[]
  entry_zone: { low: number; high: number; rationale: string }
  stop_loss: { price: number; rationale: string }
  targets: TradeTarget[]
  bull_case: string
  bear_case: string
  reasoning: string
}

// Sentiment Analysis Types
export interface NewsHeadline {
  headline: string
  source: string
  date: string
  sentiment: SignalType
  impact: ImpactLevel
  summary: string
}

export interface RatingChange {
  firm: string
  from: string
  to: string
  target_change: string
  date: string
}

export interface AnalystRatings {
  consensus: string
  buy_count: number
  hold_count: number
  sell_count: number
  average_target: number
  high_target: number
  low_target: number
  recent_changes: RatingChange[]
}

export interface SocialMedia {
  reddit_sentiment: SignalType
  twitter_sentiment: SignalType
  retail_interest: 'HIGH' | 'MEDIUM' | 'LOW'
  trending_topics: string[]
  assessment: string
}

export interface InstitutionalFlow {
  net_flow: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL'
  options_sentiment: SignalType
  put_call_ratio: number
  short_interest: string
  dark_pool_activity: string
  assessment: string
}

export interface SectorMomentum {
  sector: string
  sector_trend: SignalType
  nvda_vs_sector: 'OUTPERFORMING' | 'UNDERPERFORMING' | 'IN-LINE'
  macro_tailwinds: string[]
  macro_headwinds: string[]
  assessment: string
}

export interface UpcomingCatalyst {
  event: string
  date: string
  expected_impact: SignalType
  magnitude: ImpactLevel
}

export interface SentimentData {
  ticker: string
  analyst: string
  timestamp: string
  confidence_score: number
  signal: SignalType
  overall_sentiment_score: number
  summary: string
  news_headlines: NewsHeadline[]
  analyst_ratings: AnalystRatings
  social_media: SocialMedia
  institutional_flow: InstitutionalFlow
  sector_momentum: SectorMomentum
  upcoming_catalysts: UpcomingCatalyst[]
  bull_case: string
  bear_case: string
  reasoning: string
}

// Risk Analysis Types
export interface RiskChallenge {
  claim: string
  challenge: string
  severity: SeverityLevel
}

export interface DownsideScenario {
  scenario: string
  probability: string
  trigger: string
  price_impact: string
  estimated_price: number
  description: string
}

export interface CorrelationRisk {
  correlated_assets: string[]
  assessment: string
}

export interface RiskMetrics {
  max_drawdown_risk: string
  volatility_assessment: 'HIGH' | 'MEDIUM' | 'LOW'
  liquidity_risk: 'HIGH' | 'MEDIUM' | 'LOW'
  correlation_risk: CorrelationRisk
  black_swan_risks: string[]
  var_95: string
}

export interface PositionSizing {
  recommended_size: string
  rationale: string
  max_loss_scenario: string
  kelly_criterion: string
  suggested_allocation: string
}

export interface RiskRewardAnalysis {
  upside_target: number
  downside_target: number
  current_price: number
  risk_reward_ratio: string
  assessment: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL'
}

export interface StopLossRecommendation {
  hard_stop: number
  soft_stop: number
  rationale: string
}

export interface RiskData {
  ticker: string
  analyst: string
  timestamp: string
  overall_risk_level: 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW'
  summary: string
  challenges: {
    fundamental_challenges: RiskChallenge[]
    technical_challenges: RiskChallenge[]
    sentiment_challenges: RiskChallenge[]
  }
  downside_scenarios: DownsideScenario[]
  risk_metrics: RiskMetrics
  position_sizing: PositionSizing
  risk_reward_analysis: RiskRewardAnalysis
  stop_loss_recommendation: StopLossRecommendation
  overall_assessment: string
}

// Recommendation Types
export interface DebateEntry {
  round: number
  speaker: string
  argument: string
  type: 'BULL' | 'BEAR' | 'CHALLENGE' | 'SYNTHESIS'
}

export interface TradeParameters {
  entry_price: number
  entry_zone: { low: number; high: number }
  stop_loss: number
  stop_loss_percentage: string
  take_profit_1: number
  take_profit_2: number
  take_profit_3: number
  position_size_percentage: string
  timeframe: string
  risk_reward_ratio: string
}

export interface ExecutionPlan {
  phase_1_entry: string
  phase_2_management: string
  phase_3_exit: string
  invalidation_conditions: string[]
}

export interface RecommendationData {
  ticker: string
  generated_by: string
  timestamp: string
  signal: 'BUY' | 'HOLD' | 'SELL'
  conviction: 'HIGH' | 'MEDIUM' | 'LOW'
  overall_confidence_score: number
  analyst_scores: {
    fundamental: number
    technical: number
    sentiment: number
    risk_adjusted: number
  }
  trade_parameters: TradeParameters
  rationale: {
    bull_case: string
    bear_case: string
    deciding_factors: string[]
    key_risks: string[]
    catalysts_to_watch: string[]
  }
  debate_log: DebateEntry[]
  execution_plan: ExecutionPlan
  final_summary: string
}

export interface BacktestTrade {
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  shares: number
  pnl: number
  pnl_pct: number
  exit_reason: string
  duration_days: number
  score_at_entry: number
  win: boolean
}

export interface EquityCurvePoint {
  date: string
  portfolio_value: number
  price: number
  signal?: string
  score?: number
  in_trade?: boolean
}

export interface OptimizationResult {
  rank: number
  total_return_pct: number
  alpha_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate_pct: number
  total_trades: number
  config: {
    stop_loss_atr: number
    tp1_atr: number
    tp2_atr: number
    entry_threshold: number
    exit_threshold: number
    time_stop_days: number | null
    position_size_pct: number
    use_trailing_stop: boolean
    trend_filter: boolean
    momentum_filter: boolean
  }
}

// Multi-Ticker Backtest Types
export interface MultiBacktestTrade {
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  shares: number
  pnl: number
  pnl_pct: number
  exit_reason: string
  duration_days: number
  score_at_entry: number
  win: boolean
}

export interface MultiBacktestResult {
  ticker: string
  description: string
  total_return_pct: number
  bh_return_pct: number
  alpha_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate_pct: number
  profit_factor: number
  total_trades: number
  winning_trades: number
  losing_trades: number
  avg_win_pct: number
  avg_loss_pct: number
  avg_duration_days: number
  final_capital: number
  total_pnl: number
  best_trade: MultiBacktestTrade | null
  worst_trade: MultiBacktestTrade | null
  exit_reason_breakdown: Record<string, number>
  trades: MultiBacktestTrade[]
  equity_curve: { date: string; portfolio_value: number; price: number }[]
  start_price: number
  end_price: number
}

export interface MultiBacktestData {
  generated_at: string
  period_years?: number
  status?: string
  config_used?: {
    tickers_requested: string[]
    start_date: string | null
    end_date: string | null
    period: string
    actual_start: string
    actual_end: string
  }
  config: {
    stop_loss_atr: number
    tp1_atr: number
    tp2_atr: number
    entry_threshold: number
    exit_threshold: number
    time_stop_days: number | null
    position_size_pct: number
    use_trailing_stop: boolean
    trend_filter: boolean
    momentum_filter: boolean
  }
  results: MultiBacktestResult[]
  summary: {
    tickers_tested: number
    beats_bh_count: number
    profitable_count: number
    best_ticker: string | null
    best_alpha: number | null
    worst_ticker: string | null
    avg_alpha: number
    avg_sharpe: number
  }
  failed?: string[]
  logs?: string[]
}

export interface BacktestData {
  ticker: string
  generated_at: string
  optimization?: {
    configs_tested: number
    top_10: OptimizationResult[]
  }
  backtest_period: {
    years: number
    start_date: string
    end_date: string
    trading_days: number
  }
  config: {
    initial_capital: number
    position_size_pct: number
    commission: number
    entry_signal_threshold: number
    exit_signal_threshold: number
    stop_loss_atr_multiplier: number
    take_profit_atr_multiplier: number
    tp1_atr_multiplier?: number
    tp2_atr_multiplier?: number
    time_stop_days?: number | null
    use_trailing_stop?: boolean
    trend_filter?: boolean
    momentum_filter?: boolean
  }
  performance: {
    final_capital: number
    total_return_pct: number
    total_pnl: number
    annualized_return_pct: number
    sharpe_ratio: number
    max_drawdown_pct: number
    profit_factor: number
    win_rate_pct: number
    total_trades: number
    winning_trades: number
    losing_trades: number
    avg_win_pct: number
    avg_loss_pct: number
    avg_duration_days: number
    best_trade: BacktestTrade | null
    worst_trade: BacktestTrade | null
    exit_reason_breakdown: Record<string, number>
  }
  benchmark: {
    name: string
    return_pct: number
    final_value: number
    start_price: number
    end_price: number
    alpha_pct: number
  }
  trades: BacktestTrade[]
  equity_curve: EquityCurvePoint[]
  signal_distribution: {
    buy: number
    hold: number
    sell: number
  }
}

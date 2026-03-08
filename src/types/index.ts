export interface MathBreakdown {
  implied_prob_pct: number;
  estimated_true_prob_pct: number;
  edge_pct: number;
  cost_per_contract: number;
  payout_if_win: number;
  profit_if_win: number;
  loss_if_lose: number;
  expected_value_per_dollar: number;
  break_even_prob_pct: number;
  kelly_fraction_pct: number;
}

export interface TradeAnalysis {
  ticker: string;
  title: string;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD";
  confidence: number;
  category: string;
  event_description: string;
  the_bet: string;
  how_you_profit: string;
  summary: string;
  math_breakdown: MathBreakdown;
  pros: string[];
  cons: string[];
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  target_position: "YES" | "NO";
  entry_price: number;
  potential_return_pct: number;
}

export interface MarketData {
  ticker: string;
  title: string;
  yes_bid_dollars: number;
  yes_ask_dollars: number;
  no_bid_dollars: number;
  no_ask_dollars: number;
  last_price_dollars: number;
  volume_24h_fp: number;
  open_interest_fp: number;
  close_time: string;
  implied_probability?: number;
  expected_value?: number;
  spread?: number;
  volume_score?: number;
  status: string;
}

export interface PaperTrade {
  id: string;
  user_id: string;
  ticker: string;
  title: string;
  category: string | null;
  position: "YES" | "NO";
  entry_price: number;
  quantity: number;
  cost: number;
  status: "open" | "settled_win" | "settled_loss" | "expired";
  settled_price: number | null;
  pnl: number | null;
  confidence: number | null;
  ai_reasoning: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface PortfolioStats {
  balance: number;
  total_invested: number;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  open_trades: number;
  win_rate: number;
}

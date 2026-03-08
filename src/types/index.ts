export interface TradeAnalysis {
  ticker: string;
  title: string;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "AVOID";
  confidence: number;
  summary: string;
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

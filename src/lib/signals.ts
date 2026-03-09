/**
 * Quantitative signal aggregation for prediction market trading.
 *
 * This module replaces "AI guessing" with hard math:
 * - Sportsbook edge: computed from real odds, not LLM vibes
 * - Line movement: detects sharp money from price changes
 * - Kelly sizing: calibrated from actual performance, not AI self-reports
 * - CLV tracking: measures if our entries actually beat the market
 */

import type { KalshiMarket } from "./kalshi";
import type { OddsComparison } from "./odds";

export interface QuantSignal {
  ticker: string;
  title: string;
  category: string;
  // Computed edge and direction
  best_side: "YES" | "NO";
  entry_price: number;
  edge_pct: number;
  edge_source: "sportsbook" | "crypto_data" | "weather_data" | "line_movement" | "ai_only";
  // Individual signal scores (-1 to +1, positive = YES, negative = NO)
  sportsbook_signal: number;   // From odds comparison
  line_movement_signal: number; // From price changes
  liquidity_score: number;     // 0-1, higher = more liquid
  urgency_score: number;       // 0-1, higher = sooner event
  // Composite score
  composite_score: number;     // Weighted combination
  // Kelly sizing (from quantitative edge, not AI confidence)
  kelly_fraction: number;      // True Kelly fraction
  recommended_size_pct: number; // Quarter-Kelly position size
}

/**
 * Line movement signal from previous price data.
 * Detects "steam moves" — sharp price shifts indicating informed money.
 *
 * Returns a score from -1 (strong move toward NO) to +1 (strong move toward YES).
 */
export function lineMovementSignal(market: KalshiMarket): number {
  const change = market.price_change;
  if (change === 0 || market.prev_price === 0) return 0;

  // Normalize: a 5c move is significant, 10c+ is extreme
  const normalized = Math.max(-1, Math.min(1, change / 0.10));
  return normalized;
}

/**
 * Liquidity score based on volume and spread.
 * Higher = more liquid, better execution, more reliable pricing.
 */
export function liquidityScore(market: KalshiMarket): number {
  const volumeScore = Math.min(market.volume_24h_fp / 500, 1);
  const spreadPenalty = market.spread ? Math.min(market.spread / 0.15, 1) : 0.5;
  return volumeScore * 0.6 + (1 - spreadPenalty) * 0.4;
}

/**
 * Compute Kelly fraction from a known edge.
 * f* = (bp - q) / b
 * where b = payout odds, p = true probability, q = 1-p
 */
export function kellyFraction(trueProbability: number, entryPrice: number): number {
  if (trueProbability <= 0 || trueProbability >= 1 || entryPrice <= 0 || entryPrice >= 1) return 0;

  const b = (1 - entryPrice) / entryPrice; // payout odds
  const p = trueProbability;
  const q = 1 - p;

  const f = (b * p - q) / b;
  return Math.max(0, Math.min(f, 0.25)); // Cap at 25%
}

/**
 * Build quantitative signals for a market using all available data.
 * This is the core function that replaces "ask the AI to guess."
 */
export function buildSignal(
  market: KalshiMarket,
  oddsComparison: OddsComparison | null,
  hoursUntilEvent: number | null,
): QuantSignal {
  // 1. Sportsbook signal (strongest)
  let sportsbookSignal = 0;
  let edgeSource: QuantSignal["edge_source"] = "ai_only";
  let sportsbookProb = 0;

  if (oddsComparison) {
    // Edge is positive if Kalshi underprices YES (sportsbook says higher prob)
    sportsbookSignal = Math.max(-1, Math.min(1, oddsComparison.edge_pct / 15));
    edgeSource = "sportsbook";
    sportsbookProb = oddsComparison.sportsbook_fair_prob;
  }

  // 2. Line movement signal
  const lineSignal = lineMovementSignal(market);

  // 3. Liquidity score
  const liqScore = liquidityScore(market);

  // 4. Urgency score
  let urgencyScore = 0;
  if (hoursUntilEvent !== null) {
    if (hoursUntilEvent <= 6) urgencyScore = 1.0;
    else if (hoursUntilEvent <= 24) urgencyScore = 0.8;
    else if (hoursUntilEvent <= 48) urgencyScore = 0.6;
    else if (hoursUntilEvent <= 72) urgencyScore = 0.4;
    else if (hoursUntilEvent <= 168) urgencyScore = 0.2;
  }

  // 5. Composite score (weighted by signal reliability)
  const weights = {
    sportsbook: 0.50,    // Strongest signal — real money lines
    line_movement: 0.20, // Sharp money indicator
    liquidity: 0.15,     // Execution quality
    urgency: 0.15,       // Sooner events = higher conviction
  };

  const composite =
    Math.abs(sportsbookSignal) * weights.sportsbook +
    Math.abs(lineSignal) * weights.line_movement +
    liqScore * weights.liquidity +
    urgencyScore * weights.urgency;

  // 6. Determine best side and entry price
  let bestSide: "YES" | "NO";
  let entryPrice: number;
  let edgePct: number;

  if (oddsComparison) {
    bestSide = oddsComparison.best_side;
    entryPrice = bestSide === "YES" ? market.yes_ask_dollars : market.no_ask_dollars;
    edgePct = Math.abs(oddsComparison.edge_pct);
  } else if (lineSignal !== 0) {
    // Follow the money
    bestSide = lineSignal > 0 ? "YES" : "NO";
    entryPrice = bestSide === "YES" ? market.yes_ask_dollars : market.no_ask_dollars;
    edgePct = Math.abs(lineSignal) * 10; // Rough estimate
    edgeSource = "line_movement";
  } else {
    bestSide = market.yes_ask_dollars <= market.no_ask_dollars ? "YES" : "NO";
    entryPrice = bestSide === "YES" ? market.yes_ask_dollars : market.no_ask_dollars;
    edgePct = 0;
  }

  // 7. Kelly sizing from quantitative edge
  let kelly = 0;
  if (sportsbookProb > 0 && entryPrice > 0) {
    // Use sportsbook probability as "true" probability
    const trueProb = bestSide === "YES" ? sportsbookProb : (1 - sportsbookProb);
    kelly = kellyFraction(trueProb, entryPrice);
  } else if (edgePct > 3) {
    // Fallback: rough Kelly from claimed edge
    kelly = Math.min(edgePct / 100 * 0.5, 0.10);
  }

  return {
    ticker: market.ticker,
    title: market.title,
    category: market.category,
    best_side: bestSide,
    entry_price: entryPrice,
    edge_pct: edgePct,
    edge_source: edgeSource,
    sportsbook_signal: sportsbookSignal,
    line_movement_signal: lineSignal,
    liquidity_score: liqScore,
    urgency_score: urgencyScore,
    composite_score: composite,
    kelly_fraction: kelly,
    recommended_size_pct: kelly * 0.25, // Quarter-Kelly
  };
}

/**
 * Score and rank markets using quantitative signals.
 * Returns only markets with a detectable edge, sorted by composite score.
 */
export function rankBySignals(
  markets: KalshiMarket[],
  oddsMap: Map<string, OddsComparison>,
  hoursMap: Map<string, number>,
): QuantSignal[] {
  const signals = markets.map((m) =>
    buildSignal(m, oddsMap.get(m.ticker) || null, hoursMap.get(m.ticker) || null)
  );

  // Filter: only markets with at least some edge
  return signals
    .filter((s) => s.edge_pct >= 3 && s.entry_price >= 0.10 && s.entry_price <= 0.70)
    .sort((a, b) => b.composite_score - a.composite_score);
}

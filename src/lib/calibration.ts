/**
 * Historical calibration and CLV tracking.
 *
 * Tracks prediction accuracy over time and adjusts confidence accordingly.
 * Without calibration, the system trusts AI's self-reported confidence —
 * which is usually overconfident.
 */

import { Redis } from "@upstash/redis";
import type { PaperTrade } from "@/types";

const CALIBRATION_KEY = "paper:calibration";

interface CalibrationRecord {
  ticker: string;
  category: string;
  position: "YES" | "NO";
  ai_confidence: number;
  entry_price: number;
  closing_price: number | null;
  sportsbook_prob: number | null;
  edge_source: string;
  outcome: "win" | "loss";
  pnl: number;
  created_at: string;
  settled_at: string;
}

interface CalibrationStats {
  total_trades: number;
  win_rate: number;
  avg_clv: number;           // Average closing line value
  brier_score: number;        // Lower is better (0 = perfect, 0.25 = random)
  roi_pct: number;            // Return on investment
  by_confidence: Record<string, { trades: number; wins: number; win_rate: number }>;
  by_category: Record<string, { trades: number; wins: number; win_rate: number; roi: number }>;
  by_edge_source: Record<string, { trades: number; wins: number; win_rate: number; roi: number }>;
  calibration_adjustment: number; // Multiply AI confidence by this factor
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

/**
 * Record a settled trade for calibration tracking.
 */
export async function recordCalibration(trade: PaperTrade): Promise<void> {
  if (!trade.settled_at || trade.status === "open") return;

  const record: CalibrationRecord = {
    ticker: trade.ticker,
    category: trade.category || "Other",
    position: trade.position,
    ai_confidence: trade.confidence || 50,
    entry_price: trade.entry_price,
    closing_price: trade.closing_price ?? null,
    sportsbook_prob: trade.sportsbook_prob ?? null,
    edge_source: trade.edge_source || "ai_only",
    outcome: trade.status === "settled_win" ? "win" : "loss",
    pnl: trade.pnl || 0,
    created_at: trade.created_at,
    settled_at: trade.settled_at,
  };

  const redis = getRedis();
  await redis.lpush(CALIBRATION_KEY, record);
}

/**
 * Compute Closing Line Value for a trade.
 * CLV > 0 means you entered at a better price than the closing line.
 * Consistently positive CLV = sustainable edge.
 */
export function computeCLV(trade: PaperTrade): number | null {
  if (trade.closing_price == null) return null;

  if (trade.position === "YES") {
    // For YES: CLV = closing_price - entry_price (you bought cheap, it closed higher)
    return (trade.closing_price - trade.entry_price) / trade.entry_price * 100;
  } else {
    // For NO: CLV = (1 - closing_price) - entry_price (adjusted for NO side)
    const noClosing = 1 - trade.closing_price;
    return (noClosing - trade.entry_price) / trade.entry_price * 100;
  }
}

/**
 * Compute Brier score for a single prediction.
 * brier = (forecast_prob - actual_outcome)^2
 * 0 = perfect prediction, 0.25 = random guessing
 */
export function brierScore(forecastProb: number, won: boolean): number {
  const outcome = won ? 1 : 0;
  return (forecastProb - outcome) ** 2;
}

/**
 * Get full calibration statistics from historical trades.
 */
export async function getCalibrationStats(): Promise<CalibrationStats> {
  const redis = getRedis();
  const records = await redis.lrange<CalibrationRecord>(CALIBRATION_KEY, 0, -1) || [];

  const stats: CalibrationStats = {
    total_trades: records.length,
    win_rate: 0,
    avg_clv: 0,
    brier_score: 0,
    roi_pct: 0,
    by_confidence: {},
    by_category: {},
    by_edge_source: {},
    calibration_adjustment: 1.0,
  };

  if (records.length === 0) return stats;

  let wins = 0;
  let totalCLV = 0;
  let clvCount = 0;
  let totalBrier = 0;
  let totalCost = 0;
  let totalPnl = 0;

  for (const r of records) {
    const won = r.outcome === "win";
    if (won) wins++;

    // CLV
    if (r.closing_price != null) {
      const clv = r.position === "YES"
        ? (r.closing_price - r.entry_price) / r.entry_price * 100
        : ((1 - r.closing_price) - r.entry_price) / r.entry_price * 100;
      totalCLV += clv;
      clvCount++;
    }

    // Brier score
    const forecastProb = r.ai_confidence / 100;
    totalBrier += brierScore(forecastProb, won);

    // ROI
    totalCost += r.entry_price;
    totalPnl += r.pnl;

    // By confidence bucket
    const confBucket = `${Math.floor(r.ai_confidence / 5) * 5}-${Math.floor(r.ai_confidence / 5) * 5 + 5}`;
    if (!stats.by_confidence[confBucket]) stats.by_confidence[confBucket] = { trades: 0, wins: 0, win_rate: 0 };
    stats.by_confidence[confBucket].trades++;
    if (won) stats.by_confidence[confBucket].wins++;

    // By category
    if (!stats.by_category[r.category]) stats.by_category[r.category] = { trades: 0, wins: 0, win_rate: 0, roi: 0 };
    stats.by_category[r.category].trades++;
    if (won) stats.by_category[r.category].wins++;

    // By edge source
    if (!stats.by_edge_source[r.edge_source]) stats.by_edge_source[r.edge_source] = { trades: 0, wins: 0, win_rate: 0, roi: 0 };
    stats.by_edge_source[r.edge_source].trades++;
    if (won) stats.by_edge_source[r.edge_source].wins++;
  }

  stats.win_rate = wins / records.length;
  stats.avg_clv = clvCount > 0 ? totalCLV / clvCount : 0;
  stats.brier_score = totalBrier / records.length;
  stats.roi_pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Compute win rates
  for (const bucket of Object.values(stats.by_confidence)) {
    bucket.win_rate = bucket.trades > 0 ? bucket.wins / bucket.trades : 0;
  }
  for (const cat of Object.values(stats.by_category)) {
    cat.win_rate = cat.trades > 0 ? cat.wins / cat.trades : 0;
  }
  for (const src of Object.values(stats.by_edge_source)) {
    src.win_rate = src.trades > 0 ? src.wins / src.trades : 0;
  }

  // Calibration adjustment: if AI says 70% but actual win rate is 56%,
  // adjustment = 56/70 = 0.8 — multiply future AI confidence by 0.8
  if (records.length >= 10) {
    const avgConfidence = records.reduce((s, r) => s + r.ai_confidence, 0) / records.length;
    const actualWinRate = wins / records.length * 100;
    if (avgConfidence > 0) {
      stats.calibration_adjustment = Math.max(0.5, Math.min(1.2, actualWinRate / avgConfidence));
    }
  }

  return stats;
}

import { NextResponse } from "next/server";
import { readStore, addTrade } from "@/lib/store";
import { analyzeMarkets } from "@/lib/dedalus";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";
import type { PaperTrade } from "@/types";
import { extractDateFromTicker } from "@/lib/market-data";
import { compareOdds } from "@/lib/odds";
import { buildSignal, type QuantSignal } from "@/lib/signals";
import { getCalibrationStats } from "@/lib/calibration";

export const maxDuration = 300;

const MAX_POSITION_DOLLARS = 300;
const MAX_CATEGORY_EXPOSURE = 600;
const MAX_ENTRY_PRICE = 0.70;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { budget, batches: batchCount } = body;

    const store = await readStore();
    const maxBudget = budget || Math.min(store.balance * 0.5, 5000);

    // Track existing positions
    const openTrades = store.trades.filter((t) => t.status === "open");
    const existingTickers = new Set(openTrades.map((t) => t.ticker));
    const existingEventTickers = new Set<string>();
    for (const t of openTrades) {
      const parts = t.ticker.split("-");
      if (parts.length >= 2) {
        existingEventTickers.add(parts.slice(0, -1).join("-"));
      }
    }
    const categoryExposure: Record<string, number> = {};
    for (const t of openTrades) {
      const cat = t.category || "Other";
      categoryExposure[cat] = (categoryExposure[cat] || 0) + t.cost;
    }

    // Fetch markets
    const allMarkets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(allMarkets);
    const marketByTicker = new Map(allMarkets.map((m) => [m.ticker, m]));
    const numBatches = Math.min(batchCount || 5, 8);

    // Build diverse candidate list (round-robin across categories)
    const byCategory: Record<string, typeof ranked> = {};
    for (const m of ranked) {
      const cat = m.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(m);
    }
    const diverseList: typeof ranked = [];
    const categories = Object.keys(byCategory).sort(
      (a, b) => byCategory[b].length - byCategory[a].length
    );
    const catIndexes: Record<string, number> = {};
    categories.forEach((c) => (catIndexes[c] = 0));
    const targetCount = numBatches * 10;
    let added = true;
    while (diverseList.length < targetCount && added) {
      added = false;
      for (const cat of categories) {
        if (diverseList.length >= targetCount) break;
        const idx = catIndexes[cat];
        if (idx < byCategory[cat].length) {
          const m = byCategory[cat][idx];
          if (!existingTickers.has(m.ticker)) {
            const eventBase = m.ticker.split("-").slice(0, -1).join("-");
            if (!existingEventTickers.has(eventBase)) {
              diverseList.push(m);
            }
          }
          catIndexes[cat]++;
          added = true;
        }
      }
    }

    console.log(`[auto-trade] Candidates: ${diverseList.length} from ${allMarkets.length} raw markets`);

    // ========= STAGE 1: QUANTITATIVE SIGNALS =========
    // Compare against sportsbook odds (the strongest signal)
    const oddsComparisons = await compareOdds(
      diverseList.map((m) => ({
        ticker: m.ticker,
        title: m.title,
        category: m.category,
        yes_ask: m.yes_ask_dollars,
        no_ask: m.no_ask_dollars,
      }))
    );
    const oddsMap = new Map(oddsComparisons.map((o) => [o.ticker, o]));

    // Compute hours until event for each market
    const hoursMap = new Map<string, number>();
    for (const m of diverseList) {
      const eventDate = extractDateFromTicker(m.ticker) || extractDateFromTicker(m.event_ticker);
      if (eventDate) {
        const hours = (new Date(eventDate + "T23:59:59Z").getTime() - Date.now()) / 3600000;
        hoursMap.set(m.ticker, hours);
      }
    }

    // Build quantitative signals for all candidates
    const signals: QuantSignal[] = [];
    for (const m of diverseList) {
      const signal = buildSignal(m, oddsMap.get(m.ticker) || null, hoursMap.get(m.ticker) || null);
      if (signal.edge_pct >= 3 && signal.entry_price >= 0.10 && signal.entry_price <= MAX_ENTRY_PRICE) {
        signals.push(signal);
      }
    }
    signals.sort((a, b) => b.composite_score - a.composite_score);

    console.log(`[auto-trade] Quant signals: ${signals.length} with edge >= 3% (${oddsComparisons.length} had sportsbook matches)`);

    // ========= STAGE 2: AI ANALYSIS =========
    // Send top quant picks + remaining markets to AI for confirmation/discovery
    const quantTickers = new Set(signals.map((s) => s.ticker));

    // Markets with sportsbook edge go directly to trade (AI only vetoes)
    const sportsbookBets = signals.filter((s) => s.edge_source === "sportsbook" && s.edge_pct >= 5);

    // Markets without sportsbook data still get AI analysis
    const aiCandidates = diverseList.filter((m) => !quantTickers.has(m.ticker));
    const allAnalyses = [];
    const aiBatchCount = Math.min(numBatches, Math.ceil(aiCandidates.length / 10));
    for (let i = 0; i < aiBatchCount; i++) {
      const batch = aiCandidates.slice(i * 10, (i + 1) * 10);
      if (batch.length === 0) break;
      const analyses = await analyzeMarkets(batch);
      allAnalyses.push(...analyses);
    }

    // Filter AI picks
    const aiBets = allAnalyses.filter((a) => {
      const price = typeof a.entry_price === "string" ? parseFloat(a.entry_price) : a.entry_price;
      const confidence = typeof a.confidence === "string" ? parseFloat(a.confidence as string) : a.confidence;
      const edge = typeof a.math_breakdown?.edge_pct === "string"
        ? parseFloat(a.math_breakdown.edge_pct as string)
        : (a.math_breakdown?.edge_pct || 0);
      return (
        (a.recommendation === "STRONG_BUY" || a.recommendation === "BUY") &&
        confidence >= 55 &&
        price <= MAX_ENTRY_PRICE &&
        price >= 0.10 &&
        edge >= 3 &&
        !existingTickers.has(a.ticker)
      );
    });

    // Load calibration for adjusted sizing
    const calibration = await getCalibrationStats().catch(() => null);
    const calAdj = calibration?.calibration_adjustment || 1.0;

    if (sportsbookBets.length === 0 && aiBets.length === 0) {
      return NextResponse.json({
        message: "No trades meet criteria",
        trades_placed: 0,
        analyses_count: allAnalyses.length,
        quant_signals: signals.length,
        sportsbook_matches: oddsComparisons.length,
        markets_screened: diverseList.length,
      });
    }

    // ========= STAGE 3: PLACE TRADES =========
    let remainingBudget = Math.min(maxBudget, store.balance);
    const placedTrades: PaperTrade[] = [];
    const sessionEventTickers = new Set<string>();

    // Helper: place a trade with guardrails
    async function placeTrade(
      ticker: string,
      title: string,
      category: string,
      position: "YES" | "NO",
      entryPrice: number,
      kellyPct: number,
      confidence: number,
      reasoning: string,
      edgeSource: string,
      sportsbookProb: number | null,
    ) {
      if (remainingBudget < 1) return null;
      if (!entryPrice || isNaN(entryPrice) || entryPrice <= 0) return null;

      const betEventBase = ticker.split("-").slice(0, -1).join("-");
      if (existingEventTickers.has(betEventBase) || sessionEventTickers.has(betEventBase)) return null;

      const betCat = category || "Other";
      const currentCatExposure = categoryExposure[betCat] || 0;
      if (currentCatExposure >= MAX_CATEGORY_EXPOSURE) return null;

      // Position sizing — use quantitative Kelly, apply calibration adjustment
      const adjustedKelly = Math.min(kellyPct * calAdj, 0.15);
      const kellySize = Math.floor(remainingBudget * adjustedKelly * 0.25);
      const maxByPosition = Math.floor(MAX_POSITION_DOLLARS / entryPrice);
      const maxByBudget = Math.floor(remainingBudget / entryPrice);
      const maxByCatRoom = Math.floor((MAX_CATEGORY_EXPOSURE - currentCatExposure) / entryPrice);

      const positionSize = Math.min(Math.max(kellySize, 2), maxByPosition, maxByBudget, maxByCatRoom);
      if (positionSize <= 0) return null;

      const cost = entryPrice * positionSize;
      if (cost > remainingBudget) return null;

      const eventDate = extractDateFromTicker(ticker);
      const trade = await addTrade({
        user_id: "local",
        ticker,
        title,
        category,
        position,
        entry_price: entryPrice,
        quantity: positionSize,
        cost,
        confidence,
        ai_reasoning: reasoning,
        close_time: eventDate ? eventDate + "T23:59:59Z" : marketByTicker.get(ticker)?.close_time || null,
      });

      placedTrades.push(trade);
      remainingBudget -= cost;
      categoryExposure[betCat] = (categoryExposure[betCat] || 0) + cost;
      sessionEventTickers.add(betEventBase);
      existingEventTickers.add(betEventBase);
      return trade;
    }

    // 1. Place sportsbook-backed trades first (strongest signal)
    for (const signal of sportsbookBets) {
      await placeTrade(
        signal.ticker,
        signal.title,
        signal.category,
        signal.best_side,
        signal.entry_price,
        signal.kelly_fraction,
        Math.round(50 + signal.edge_pct), // Confidence from edge size
        JSON.stringify({
          recommendation: signal.edge_pct >= 10 ? "STRONG_BUY" : "BUY",
          edge_source: "sportsbook",
          edge_pct: signal.edge_pct,
          sportsbook_signal: signal.sportsbook_signal,
          line_movement: signal.line_movement_signal,
          composite_score: signal.composite_score,
          the_bet: `Sportsbook edge: ${signal.edge_pct.toFixed(1)}% — sportsbooks price this differently than Kalshi`,
          summary: `Quantitative signal: sportsbook consensus disagrees with Kalshi by ${signal.edge_pct.toFixed(1)}%. Composite score: ${signal.composite_score.toFixed(2)}.`,
        }),
        "sportsbook",
        signal.edge_pct > 0 ? (signal.entry_price + signal.edge_pct / 100) : null,
      );
    }

    // 2. Place AI-backed trades (for markets without sportsbook data)
    for (const bet of aiBets) {
      const entryPrice = typeof bet.entry_price === "string" ? parseFloat(bet.entry_price) : bet.entry_price;
      const kellyRaw = bet.math_breakdown?.kelly_fraction_pct;
      const kellyParsed = typeof kellyRaw === "string" ? parseFloat(kellyRaw) : (kellyRaw || 5);

      await placeTrade(
        bet.ticker,
        bet.title,
        bet.category,
        bet.target_position,
        entryPrice,
        kellyParsed / 100,
        typeof bet.confidence === "string" ? parseFloat(bet.confidence as string) : bet.confidence,
        JSON.stringify({
          recommendation: bet.recommendation,
          confidence: bet.confidence,
          edge_source: "ai_analysis",
          event_description: bet.event_description,
          the_bet: bet.the_bet,
          how_you_profit: bet.how_you_profit,
          summary: bet.summary,
          math_breakdown: bet.math_breakdown,
          pros: bet.pros,
          cons: bet.cons,
          risk_level: bet.risk_level,
          potential_return_pct: bet.potential_return_pct,
        }),
        "ai_only",
        null,
      );
    }

    const totalCost = placedTrades.reduce((sum, t) => sum + t.cost, 0);

    return NextResponse.json({
      trades_placed: placedTrades.length,
      total_cost: totalCost,
      remaining_balance: store.balance - totalCost,
      trades: placedTrades,
      analyses_count: allAnalyses.length,
      quant_signals: signals.length,
      sportsbook_trades: sportsbookBets.length,
      ai_trades: aiBets.length,
      calibration_adjustment: calAdj,
    });
  } catch (error) {
    console.error("Auto-trade failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-trade failed" },
      { status: 500 }
    );
  }
}

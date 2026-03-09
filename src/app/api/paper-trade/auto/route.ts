import { NextResponse } from "next/server";
import { readStore, addTrade } from "@/lib/store";
import { analyzeMarkets } from "@/lib/dedalus";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";

export const maxDuration = 300;

// Max cost for any single trade as fraction of starting capital
const MAX_POSITION_PCT = 0.03; // 3% of $10k = $300
const MAX_POSITION_DOLLARS = 300;
// Max total exposure per category
const MAX_CATEGORY_EXPOSURE = 600; // $600 per category
// Max entry price (reject low-return bets)
const MAX_ENTRY_PRICE = 0.70; // Don't pay >70c to win <30c

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { budget, batches: batchCount } = body;

    const store = await readStore();
    const maxBudget = budget || Math.min(store.balance * 0.5, 5000);

    // Track existing positions to prevent conflicts
    const openTrades = store.trades.filter((t) => t.status === "open");
    const existingTickers = new Set(openTrades.map((t) => t.ticker));

    // Track existing event_tickers to prevent both-sides bets
    const existingEventTickers = new Set<string>();
    for (const t of openTrades) {
      // Extract event ticker from market ticker (e.g. KXDOTA2GAME-26MAR09PARILIQUID-PARI -> KXDOTA2GAME-26MAR09PARILIQUID)
      const parts = t.ticker.split("-");
      if (parts.length >= 2) {
        existingEventTickers.add(parts.slice(0, -1).join("-"));
      }
    }

    // Track category exposure
    const categoryExposure: Record<string, number> = {};
    for (const t of openTrades) {
      const cat = t.category || "Other";
      categoryExposure[cat] = (categoryExposure[cat] || 0) + t.cost;
    }

    const allMarkets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(allMarkets);
    const marketByTicker = new Map(allMarkets.map((m) => [m.ticker, m]));
    const numBatches = Math.min(batchCount || 5, 8);

    console.log(`[auto-trade] Raw markets: ${allMarkets.length}, Ranked: ${ranked.length}, Existing tickers: ${existingTickers.size}, Existing events: ${existingEventTickers.size}`);

    // Build diverse batches: round-robin across categories
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
            // Skip if we already have a bet on this event
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

    console.log(`[auto-trade] DiverseList: ${diverseList.length}, Categories: ${categories.length}, Target: ${targetCount}`);

    const allAnalyses = [];
    for (let i = 0; i < numBatches; i++) {
      const batch = diverseList.slice(i * 10, (i + 1) * 10);
      if (batch.length === 0) break;
      const analyses = await analyzeMarkets(batch);
      allAnalyses.push(...analyses);
    }

    const bets = allAnalyses.filter(
      (a) =>
        (a.recommendation === "STRONG_BUY" || a.recommendation === "BUY") &&
        a.confidence >= 55 &&
        a.entry_price <= MAX_ENTRY_PRICE &&
        a.entry_price >= 0.10 && // Don't take extreme longshots
        // Require a minimum edge claim
        (a.math_breakdown?.edge_pct || 0) >= 3 &&
        !existingTickers.has(a.ticker)
    );

    if (bets.length === 0) {
      return NextResponse.json({
        message: "No trades meet criteria",
        trades_placed: 0,
        analyses_count: allAnalyses.length,
        debug: {
          raw_markets: allMarkets.length,
          ranked_markets: ranked.length,
          diverse_list: diverseList.length,
          existing_positions: existingTickers.size,
          blocked_events: existingEventTickers.size,
          categories: categories.length,
        },
      });
    }

    let remainingBudget = Math.min(maxBudget, store.balance);
    const placedTrades = [];
    // Track event tickers placed this session to prevent contradicting bets
    const sessionEventTickers = new Set<string>();

    for (const bet of bets) {
      if (remainingBudget < 1) break;

      // Check: don't bet both sides of the same event
      const betEventBase = bet.ticker.split("-").slice(0, -1).join("-");
      if (existingEventTickers.has(betEventBase) || sessionEventTickers.has(betEventBase)) {
        continue;
      }

      // Check: category exposure cap
      const betCat = bet.category || "Other";
      const currentCatExposure = categoryExposure[betCat] || 0;
      if (currentCatExposure >= MAX_CATEGORY_EXPOSURE) {
        continue;
      }

      // Position sizing with caps
      const kellyFraction = Math.min(
        (bet.math_breakdown?.kelly_fraction_pct || 5) / 100,
        0.15 // Cap Kelly at 15%
      );
      const kellySize = Math.floor(remainingBudget * kellyFraction * 0.25); // quarter-Kelly
      const maxByPosition = Math.floor(MAX_POSITION_DOLLARS / bet.entry_price);
      const maxByBudget = Math.floor(remainingBudget / bet.entry_price);
      const maxByCatRoom = Math.floor(
        (MAX_CATEGORY_EXPOSURE - currentCatExposure) / bet.entry_price
      );

      const positionSize = Math.min(
        Math.max(kellySize, 2),
        maxByPosition,
        maxByBudget,
        maxByCatRoom
      );

      if (positionSize <= 0) continue;

      const cost = bet.entry_price * positionSize;
      if (cost > remainingBudget) continue;

      const trade = await addTrade({
        user_id: "local",
        ticker: bet.ticker,
        title: bet.title,
        category: bet.category,
        position: bet.target_position,
        entry_price: bet.entry_price,
        quantity: positionSize,
        cost,
        confidence: bet.confidence,
        ai_reasoning: JSON.stringify({
          recommendation: bet.recommendation,
          confidence: bet.confidence,
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
        close_time: marketByTicker.get(bet.ticker)?.close_time || null,
      });

      placedTrades.push(trade);
      remainingBudget -= cost;
      categoryExposure[betCat] = (categoryExposure[betCat] || 0) + cost;
      sessionEventTickers.add(betEventBase);
      existingEventTickers.add(betEventBase);
    }

    const totalCost = placedTrades.reduce((sum, t) => sum + t.cost, 0);

    return NextResponse.json({
      trades_placed: placedTrades.length,
      total_cost: totalCost,
      remaining_balance: store.balance - totalCost,
      trades: placedTrades,
      analyses_count: allAnalyses.length,
    });
  } catch (error) {
    console.error("Auto-trade failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-trade failed" },
      { status: 500 }
    );
  }
}

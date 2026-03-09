import { NextResponse } from "next/server";
import { readStore, addTrade } from "@/lib/store";
import { analyzeMarkets } from "@/lib/dedalus";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { budget, batches: batchCount } = body;

    const store = await readStore();
    const maxBudget = budget || Math.min(store.balance * 0.5, 5000);

    const existingTickers = new Set(
      store.trades.filter((t) => t.status === "open").map((t) => t.ticker)
    );

    const allMarkets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(allMarkets);
    const marketByTicker = new Map(allMarkets.map((m) => [m.ticker, m]));
    const numBatches = Math.min(batchCount || 5, 8);

    // Build diverse batches: pick markets across different categories
    // so we don't end up with all crypto or all politics
    const byCategory: Record<string, typeof ranked> = {};
    for (const m of ranked) {
      const cat = m.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(m);
    }

    // Round-robin across categories to build diverse market list
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
            diverseList.push(m);
          }
          catIndexes[cat]++;
          added = true;
        }
      }
    }

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
        !existingTickers.has(a.ticker)
    );

    if (bets.length === 0) {
      return NextResponse.json({
        message: "No trades meet criteria",
        trades_placed: 0,
        analyses_count: allAnalyses.length,
      });
    }

    let remainingBudget = Math.min(maxBudget, store.balance);
    const placedTrades = [];

    for (const bet of bets) {
      if (remainingBudget < 1) break;

      const kellyFraction = (bet.math_breakdown?.kelly_fraction_pct || 5) / 100;
      const positionSize = Math.min(
        Math.max(Math.floor(remainingBudget * kellyFraction * 0.5), 2),
        Math.floor(remainingBudget / bet.entry_price)
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

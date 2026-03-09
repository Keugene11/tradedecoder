import { NextResponse } from "next/server";
import { readStore, updateTrade } from "@/lib/store";
import { analyzeSpecificMarket } from "@/lib/dedalus";
import { fetchMarketByTicker } from "@/lib/kalshi";

export const maxDuration = 300;

export async function POST() {
  try {
    const store = await readStore();
    const openTrades = store.trades.filter((t) => t.status === "open");

    if (openTrades.length === 0) {
      return NextResponse.json({ updated: 0, message: "No open trades" });
    }

    let updated = 0;
    let failed = 0;

    // Process in batches of 5 to avoid timeout
    const batchSize = 5;
    for (let i = 0; i < openTrades.length; i += batchSize) {
      const batch = openTrades.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (trade) => {
          const market = await fetchMarketByTicker(trade.ticker);
          if (!market) return null;

          const analysis = await analyzeSpecificMarket(market);
          if (!analysis) return null;

          await updateTrade(trade.id, {
            ai_reasoning: JSON.stringify({
              recommendation: analysis.recommendation,
              confidence: analysis.confidence,
              summary: analysis.summary,
              pros: analysis.pros,
              cons: analysis.cons,
              risk_level: analysis.risk_level,
              potential_return_pct: analysis.potential_return_pct,
            }),
          });

          return trade.ticker;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) updated++;
        else failed++;
      }
    }

    return NextResponse.json({
      updated,
      failed,
      total: openTrades.length,
      message: `Re-analyzed ${updated} of ${openTrades.length} trades`,
    });
  } catch (error) {
    console.error("Reanalyze failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reanalyze failed" },
      { status: 500 }
    );
  }
}

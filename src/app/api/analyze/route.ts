import { NextResponse } from "next/server";
import { analyzeMarkets } from "@/lib/dedalus";
import { getServiceClient } from "@/lib/supabase";
import type { KalshiMarket } from "@/lib/kalshi";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Accept pre-fetched markets from client to avoid double-fetching
    const body = await request.json().catch(() => null);
    let topMarkets: KalshiMarket[] = [];

    if (body?.markets && Array.isArray(body.markets)) {
      topMarkets = body.markets.slice(0, 10);
    } else {
      // Fallback: fetch directly but only 1 page
      const { fetchMarkets, scoreAndRankMarkets } = await import("@/lib/kalshi");
      const result = await fetchMarkets({ status: "open", limit: 1000 });
      const ranked = scoreAndRankMarkets(result.markets);
      topMarkets = ranked.slice(0, 10);
    }

    if (topMarkets.length === 0) {
      return NextResponse.json(
        { error: "No markets to analyze" },
        { status: 400 }
      );
    }

    const analyses = await analyzeMarkets(topMarkets);

    // Store in Supabase (fire-and-forget, don't block response)
    const supabase = getServiceClient();
    Promise.all(
      analyses.map((analysis) =>
        supabase.from("trade_analyses").upsert(
          {
            ticker: analysis.ticker,
            title: analysis.title,
            recommendation: analysis.recommendation,
            confidence: analysis.confidence,
            summary: analysis.summary,
            pros: analysis.pros,
            cons: analysis.cons,
            risk_level: analysis.risk_level,
            target_position: analysis.target_position,
            entry_price: analysis.entry_price,
            potential_return_pct: analysis.potential_return_pct,
            analyzed_at: new Date().toISOString(),
          },
          { onConflict: "ticker" }
        )
      )
    ).catch((err) => console.error("Supabase upsert error:", err));

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("Analysis failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Analysis failed", details: message },
      { status: 500 }
    );
  }
}

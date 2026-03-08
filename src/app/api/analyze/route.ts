import { NextResponse } from "next/server";
import { analyzeMarkets } from "@/lib/dedalus";
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

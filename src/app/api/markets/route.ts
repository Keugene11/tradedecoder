import { NextResponse } from "next/server";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";

export async function GET() {
  try {
    const markets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(markets);

    return NextResponse.json({
      total: markets.length,
      ranked_count: ranked.length,
      markets: ranked.slice(0, 50),
    });
  } catch (error) {
    console.error("Failed to fetch markets:", error);
    return NextResponse.json(
      { error: "Failed to fetch Kalshi markets" },
      { status: 500 }
    );
  }
}

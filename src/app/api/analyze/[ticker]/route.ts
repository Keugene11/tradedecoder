import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/kalshi";
import { analyzeSpecificMarket } from "@/lib/dedalus";
import { enrichMarket } from "@/lib/kalshi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const { markets } = await fetchMarkets({ tickers: ticker } as never);

    if (!markets.length) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const enriched = enrichMarket(markets[0]);
    const analysis = await analyzeSpecificMarket(enriched);

    return NextResponse.json({ market: enriched, analysis });
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}

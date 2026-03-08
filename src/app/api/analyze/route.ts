import { NextResponse } from "next/server";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";
import { analyzeMarkets } from "@/lib/dedalus";
import { getServiceClient } from "@/lib/supabase";

export async function POST() {
  try {
    const markets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(markets);
    const topMarkets = ranked.slice(0, 15);

    const analyses = await analyzeMarkets(topMarkets);

    // Store in Supabase
    const supabase = getServiceClient();
    for (const analysis of analyses) {
      await supabase.from("trade_analyses").upsert(
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
      );
    }

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

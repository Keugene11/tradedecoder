import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { analyzeMarkets } from "@/lib/dedalus";
import { fetchAllOpenMarkets, scoreAndRankMarkets } from "@/lib/kalshi";

export const maxDuration = 60;

// AI auto-trades: analyzes markets and places bets on the most profitable ones
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, budget } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Check balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("paper_balance")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const maxBudget = budget || Math.min(profile.paper_balance * 0.3, 2000); // Max 30% of balance or $2000

    // Check for existing open trades to avoid duplicates
    const { data: existingTrades } = await supabase
      .from("paper_trades")
      .select("ticker")
      .eq("user_id", user_id)
      .eq("status", "open");

    const existingTickers = new Set(existingTrades?.map((t) => t.ticker) ?? []);

    // Fetch and analyze markets
    const allMarkets = await fetchAllOpenMarkets();
    const ranked = scoreAndRankMarkets(allMarkets);
    const topMarkets = ranked.slice(0, 10);

    const analyses = await analyzeMarkets(topMarkets);

    // Bet on STRONG_BUY or BUY with decent confidence
    const bets = analyses.filter(
      (a) =>
        (a.recommendation === "STRONG_BUY" || a.recommendation === "BUY") &&
        a.confidence >= 60 &&
        !existingTickers.has(a.ticker)
    );

    if (bets.length === 0) {
      return NextResponse.json({
        message: "No trades meet criteria",
        trades_placed: 0,
        analyses_count: analyses.length,
      });
    }

    // Calculate position sizes using Kelly criterion (capped)
    let remainingBudget = Math.min(maxBudget, profile.paper_balance);
    const placedTrades = [];

    for (const bet of bets) {
      if (remainingBudget < 1) break;

      // Use a fraction of Kelly for safety (quarter Kelly)
      const kellyFraction = (bet.math_breakdown?.kelly_fraction_pct || 5) / 100;
      const positionSize = Math.min(
        Math.max(Math.floor(remainingBudget * kellyFraction * 0.25), 1),
        Math.floor(remainingBudget / bet.entry_price)
      );

      if (positionSize <= 0) continue;

      const cost = bet.entry_price * positionSize;
      if (cost > remainingBudget) continue;

      const { data: trade, error } = await supabase
        .from("paper_trades")
        .insert({
          user_id,
          ticker: bet.ticker,
          title: bet.title,
          category: bet.category,
          position: bet.target_position,
          entry_price: bet.entry_price,
          quantity: positionSize,
          cost,
          confidence: bet.confidence,
          ai_reasoning: `${bet.recommendation} (${bet.confidence}% conf): ${bet.summary.slice(0, 500)}`,
        })
        .select()
        .single();

      if (!error && trade) {
        placedTrades.push(trade);
        remainingBudget -= cost;
      }
    }

    // Deduct total cost from balance
    const totalCost = placedTrades.reduce((sum, t) => sum + t.cost, 0);
    if (totalCost > 0) {
      await supabase
        .from("profiles")
        .update({
          paper_balance: profile.paper_balance - totalCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id);
    }

    return NextResponse.json({
      trades_placed: placedTrades.length,
      total_cost: totalCost,
      remaining_balance: profile.paper_balance - totalCost,
      trades: placedTrades,
      analyses_count: analyses.length,
    });
  } catch (error) {
    console.error("Auto-trade failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-trade failed" },
      { status: 500 }
    );
  }
}

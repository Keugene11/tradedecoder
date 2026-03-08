import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { fetchMarkets } from "@/lib/kalshi";

export const maxDuration = 30;

// Settle open trades by checking current market prices
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Get open trades
    const { data: openTrades } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "open");

    if (!openTrades || openTrades.length === 0) {
      return NextResponse.json({ settled: 0 });
    }

    // Fetch current market data
    const result = await fetchMarkets({ status: "open", limit: 1000 });
    const marketMap = new Map(
      result.markets.map((m) => [m.ticker, m])
    );

    let settledCount = 0;
    let totalPnlChange = 0;

    for (const trade of openTrades) {
      const market = marketMap.get(trade.ticker);

      // If market is no longer open, it has settled
      if (!market) {
        // Market closed/settled - check if it resolved YES or NO
        // For now, simulate: if the market is gone, it resolved
        // We'll mark as expired and refund
        const pnl = -trade.cost * 0.1; // Small loss for expired
        await supabase
          .from("paper_trades")
          .update({
            status: "expired",
            pnl,
            settled_at: new Date().toISOString(),
          })
          .eq("id", trade.id);

        totalPnlChange += pnl;
        settledCount++;
        continue;
      }

      // Check if market price moved significantly - simulate settlement
      const currentPrice =
        trade.position === "YES"
          ? market.yes_bid_dollars
          : market.no_bid_dollars;

      // If price hit $0.95+ (near certainty), settle as win
      // If price hit $0.05 or less, settle as loss
      if (currentPrice >= 0.95) {
        const pnl = (1 - trade.entry_price) * trade.quantity;
        await supabase
          .from("paper_trades")
          .update({
            status: "settled_win",
            settled_price: currentPrice,
            pnl,
            settled_at: new Date().toISOString(),
          })
          .eq("id", trade.id);

        totalPnlChange += pnl;
        settledCount++;
      } else if (currentPrice <= 0.05) {
        const pnl = -trade.cost;
        await supabase
          .from("paper_trades")
          .update({
            status: "settled_loss",
            settled_price: currentPrice,
            pnl,
            settled_at: new Date().toISOString(),
          })
          .eq("id", trade.id);

        totalPnlChange += pnl;
        settledCount++;
      }
    }

    // Update balance with PnL
    if (totalPnlChange !== 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("paper_balance")
        .eq("id", user_id)
        .single();

      if (profile) {
        // For wins: return cost + profit. For losses: already deducted
        const balanceAdjust = openTrades
          .filter((t) => {
            const m = marketMap.get(t.ticker);
            if (!m) return true;
            const cp =
              t.position === "YES"
                ? m.yes_bid_dollars
                : m.no_bid_dollars;
            return cp >= 0.95 || cp <= 0.05;
          })
          .reduce((sum, t) => {
            const m = marketMap.get(t.ticker);
            if (!m) return sum + t.cost * 0.9; // Refund 90% for expired
            const cp =
              t.position === "YES"
                ? m.yes_bid_dollars
                : m.no_bid_dollars;
            if (cp >= 0.95) return sum + t.quantity * 1; // $1 payout per contract
            return sum; // Loss - already deducted
          }, 0);

        await supabase
          .from("profiles")
          .update({
            paper_balance: profile.paper_balance + balanceAdjust,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user_id);
      }
    }

    return NextResponse.json({ settled: settledCount, pnl_change: totalPnlChange });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settlement failed" },
      { status: 500 }
    );
  }
}

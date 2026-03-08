import { NextResponse } from "next/server";
import { readStore, updateTrade, writeStore } from "@/lib/store";
import { fetchMarkets } from "@/lib/kalshi";

export const maxDuration = 30;

export async function POST() {
  try {
    const store = await readStore();
    const openTrades = store.trades.filter((t) => t.status === "open");

    if (openTrades.length === 0) {
      return NextResponse.json({ settled: 0, actions: [] });
    }

    const result = await fetchMarkets({ status: "open", limit: 1000 });
    const marketMap = new Map(result.markets.map((m) => [m.ticker, m]));

    let totalBalanceReturn = 0;
    const actions: { ticker: string; action: string; pnl: number; reason: string }[] = [];

    for (const trade of openTrades) {
      const market = marketMap.get(trade.ticker);

      if (!market) {
        const expired = trade.close_time && new Date(trade.close_time) < new Date();
        if (expired) {
          const pnl = -trade.cost * 0.5;
          await updateTrade(trade.id, {
            status: "expired",
            pnl,
            settled_at: new Date().toISOString(),
          });
          totalBalanceReturn += trade.cost * 0.5;
          actions.push({
            ticker: trade.ticker,
            action: "EXPIRED",
            pnl,
            reason: "Market resolved, outcome unknown",
          });
        }
        continue;
      }

      const currentBid =
        trade.position === "YES" ? market.yes_bid_dollars : market.no_bid_dollars;

      const sellValue = currentBid * trade.quantity;
      const unrealizedPnl = sellValue - trade.cost;
      const returnPct = (unrealizedPnl / trade.cost) * 100;

      if (currentBid >= 0.9) {
        const pnl = sellValue - trade.cost;
        await updateTrade(trade.id, {
          status: "settled_win",
          settled_price: currentBid,
          pnl,
          settled_at: new Date().toISOString(),
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "SOLD_WIN",
          pnl,
          reason: `Price hit $${currentBid.toFixed(2)} — locked in ${returnPct.toFixed(0)}% profit`,
        });
        continue;
      }

      if (currentBid <= 0.1) {
        const pnl = sellValue - trade.cost;
        await updateTrade(trade.id, {
          status: "settled_loss",
          settled_price: currentBid,
          pnl,
          settled_at: new Date().toISOString(),
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "SOLD_LOSS",
          pnl,
          reason: `Price dropped to $${currentBid.toFixed(2)} — cut losses`,
        });
        continue;
      }

      if (returnPct >= 30) {
        const pnl = sellValue - trade.cost;
        await updateTrade(trade.id, {
          status: "settled_win",
          settled_price: currentBid,
          pnl,
          settled_at: new Date().toISOString(),
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "TAKE_PROFIT",
          pnl,
          reason: `Up ${returnPct.toFixed(0)}% — taking profit at $${currentBid.toFixed(2)}`,
        });
        continue;
      }

      if (returnPct <= -40) {
        const pnl = sellValue - trade.cost;
        await updateTrade(trade.id, {
          status: "settled_loss",
          settled_price: currentBid,
          pnl,
          settled_at: new Date().toISOString(),
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "STOP_LOSS",
          pnl,
          reason: `Down ${returnPct.toFixed(0)}% — stopping loss at $${currentBid.toFixed(2)}`,
        });
        continue;
      }
    }

    if (totalBalanceReturn > 0) {
      const updated = await readStore();
      updated.balance += totalBalanceReturn;
      await writeStore(updated);
    }

    return NextResponse.json({
      settled: actions.length,
      balance_returned: totalBalanceReturn,
      actions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settlement failed" },
      { status: 500 }
    );
  }
}

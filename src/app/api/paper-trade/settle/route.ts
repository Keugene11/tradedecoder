import { NextResponse } from "next/server";
import { readStore, updateTrade, writeStore } from "@/lib/store";
import { fetchMarkets, fetchMarketByTicker } from "@/lib/kalshi";
import { recordCalibration } from "@/lib/calibration";

export const maxDuration = 60;

export async function POST() {
  try {
    const store = await readStore();
    const openTrades = store.trades.filter((t) => t.status === "open");

    if (openTrades.length === 0) {
      return NextResponse.json({ settled: 0, actions: [] });
    }

    // Fetch all open markets to check prices on still-active trades
    const result = await fetchMarkets({ status: "open", limit: 1000 });
    const openMarketMap = new Map(result.markets.map((m) => [m.ticker, m]));

    let totalBalanceReturn = 0;
    const actions: { ticker: string; action: string; pnl: number; reason: string }[] = [];

    for (const trade of openTrades) {
      const openMarket = openMarketMap.get(trade.ticker);

      // Market is NOT in the open list — it may have resolved
      if (!openMarket) {
        // Fetch the specific market to check its result
        const resolved = await fetchMarketByTicker(trade.ticker);

        if (resolved && resolved.result) {
          // Market has a result — "yes" or "no"
          const won =
            (trade.position === "YES" && resolved.result === "yes") ||
            (trade.position === "NO" && resolved.result === "no");

          if (won) {
            // Win: each contract pays $1
            const payout = 1.0 * trade.quantity;
            const pnl = payout - trade.cost;
            const settledAt = new Date().toISOString();
            await updateTrade(trade.id, {
              status: "settled_win",
              settled_price: 1.0,
              pnl,
              settled_at: settledAt,
            });
            totalBalanceReturn += payout;
            actions.push({
              ticker: trade.ticker,
              action: "RESOLVED_WIN",
              pnl,
              reason: `Market resolved ${resolved.result.toUpperCase()} — won $${payout.toFixed(2)} (+$${pnl.toFixed(2)} profit)`,
            });
            await recordCalibration({ ...trade, status: "settled_win", settled_price: 1.0, pnl, settled_at: settledAt });
          } else {
            // Loss: contracts worth $0
            const pnl = -trade.cost;
            const settledAt = new Date().toISOString();
            await updateTrade(trade.id, {
              status: "settled_loss",
              settled_price: 0,
              pnl,
              settled_at: settledAt,
            });
            // No balance return — contracts are worthless
            actions.push({
              ticker: trade.ticker,
              action: "RESOLVED_LOSS",
              pnl,
              reason: `Market resolved ${resolved.result.toUpperCase()} — lost $${trade.cost.toFixed(2)}`,
            });
            await recordCalibration({ ...trade, status: "settled_loss", settled_price: 0, pnl, settled_at: settledAt });
          }
        } else if (trade.close_time && new Date(trade.close_time) < new Date()) {
          // Market not found and past close time — treat as expired
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
            reason: "Market no longer available — refunded 50%",
          });
        }
        continue;
      }

      // Market is still open — check current price for early exit
      const currentBid =
        trade.position === "YES" ? openMarket.yes_bid_dollars : openMarket.no_bid_dollars;

      const sellValue = currentBid * trade.quantity;
      const unrealizedPnl = sellValue - trade.cost;
      const returnPct = (unrealizedPnl / trade.cost) * 100;

      if (currentBid >= 0.9) {
        const pnl = sellValue - trade.cost;
        const settledAt = new Date().toISOString();
        await updateTrade(trade.id, {
          status: "settled_win",
          settled_price: currentBid,
          pnl,
          settled_at: settledAt,
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "SOLD_WIN",
          pnl,
          reason: `Price hit $${currentBid.toFixed(2)} — locked in ${returnPct.toFixed(0)}% profit`,
        });
        await recordCalibration({ ...trade, status: "settled_win", settled_price: currentBid, pnl, settled_at: settledAt, closing_price: currentBid });
        continue;
      }

      if (currentBid <= 0.1) {
        const pnl = sellValue - trade.cost;
        const settledAt = new Date().toISOString();
        await updateTrade(trade.id, {
          status: "settled_loss",
          settled_price: currentBid,
          pnl,
          settled_at: settledAt,
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "SOLD_LOSS",
          pnl,
          reason: `Price dropped to $${currentBid.toFixed(2)} — cut losses`,
        });
        await recordCalibration({ ...trade, status: "settled_loss", settled_price: currentBid, pnl, settled_at: settledAt, closing_price: currentBid });
        continue;
      }

      if (returnPct >= 30) {
        const pnl = sellValue - trade.cost;
        const settledAt = new Date().toISOString();
        await updateTrade(trade.id, {
          status: "settled_win",
          settled_price: currentBid,
          pnl,
          settled_at: settledAt,
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "TAKE_PROFIT",
          pnl,
          reason: `Up ${returnPct.toFixed(0)}% — taking profit at $${currentBid.toFixed(2)}`,
        });
        await recordCalibration({ ...trade, status: "settled_win", settled_price: currentBid, pnl, settled_at: settledAt, closing_price: currentBid });
        continue;
      }

      if (returnPct <= -40) {
        const pnl = sellValue - trade.cost;
        const settledAt = new Date().toISOString();
        await updateTrade(trade.id, {
          status: "settled_loss",
          settled_price: currentBid,
          pnl,
          settled_at: settledAt,
        });
        totalBalanceReturn += sellValue;
        actions.push({
          ticker: trade.ticker,
          action: "STOP_LOSS",
          pnl,
          reason: `Down ${returnPct.toFixed(0)}% — stopping loss at $${currentBid.toFixed(2)}`,
        });
        await recordCalibration({ ...trade, status: "settled_loss", settled_price: currentBid, pnl, settled_at: settledAt, closing_price: currentBid });
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

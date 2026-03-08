import { NextResponse } from "next/server";
import { readStore, addTrade } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  const trades = store.trades;
  const openTrades = trades.filter((t) => t.status === "open");
  const settledTrades = trades.filter((t) => t.status !== "open");
  const wins = settledTrades.filter((t) => t.status === "settled_win");
  const totalPnl = settledTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalInvested = openTrades.reduce((sum, t) => sum + t.cost, 0);

  return NextResponse.json({
    trades,
    stats: {
      balance: store.balance,
      total_invested: totalInvested,
      total_pnl: totalPnl,
      total_trades: settledTrades.length,
      winning_trades: wins.length,
      open_trades: openTrades.length,
      win_rate:
        settledTrades.length > 0
          ? Math.round((wins.length / settledTrades.length) * 100)
          : 0,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, title, category, position, entry_price, quantity, confidence, ai_reasoning } = body;

    if (!ticker || !title || !position || !entry_price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cost = entry_price * (quantity || 1);
    const store = await readStore();

    if (store.balance < cost) {
      return NextResponse.json({ error: "Insufficient paper balance" }, { status: 400 });
    }

    const trade = await addTrade({
      user_id: "local",
      ticker,
      title,
      category,
      position,
      entry_price,
      quantity: quantity || 1,
      cost,
      confidence,
      ai_reasoning,
      close_time: null,
    });

    return NextResponse.json({ trade });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place trade" },
      { status: 500 }
    );
  }
}

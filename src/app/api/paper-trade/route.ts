import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: trades, error } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("paper_balance")
    .eq("id", userId)
    .single();

  const balance = profile?.paper_balance ?? 10000;
  const openTrades = trades?.filter((t) => t.status === "open") ?? [];
  const settledTrades = trades?.filter((t) => t.status !== "open") ?? [];
  const wins = settledTrades.filter((t) => t.status === "settled_win");
  const totalPnl = settledTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalInvested = openTrades.reduce((sum, t) => sum + t.cost, 0);

  return NextResponse.json({
    trades: trades ?? [],
    stats: {
      balance,
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

// Place a new paper trade
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, ticker, title, category, position, entry_price, quantity, confidence, ai_reasoning } = body;

    if (!user_id || !ticker || !title || !position || !entry_price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cost = entry_price * (quantity || 1);
    const supabase = getServiceClient();

    // Check balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("paper_balance")
      .eq("id", user_id)
      .single();

    if (!profile || profile.paper_balance < cost) {
      return NextResponse.json({ error: "Insufficient paper balance" }, { status: 400 });
    }

    // Deduct from balance
    await supabase
      .from("profiles")
      .update({ paper_balance: profile.paper_balance - cost, updated_at: new Date().toISOString() })
      .eq("id", user_id);

    // Create trade
    const { data: trade, error } = await supabase
      .from("paper_trades")
      .insert({
        user_id,
        ticker,
        title,
        category,
        position,
        entry_price,
        quantity: quantity || 1,
        cost,
        confidence,
        ai_reasoning,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place trade" },
      { status: 500 }
    );
  }
}

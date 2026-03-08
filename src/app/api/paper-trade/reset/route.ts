import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

export async function POST() {
  try {
    const deleted = await resetStore();
    return NextResponse.json({ deleted, balance: 10000 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 500 }
    );
  }
}

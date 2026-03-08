import { Redis } from "@upstash/redis";
import type { PaperTrade } from "@/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BALANCE_KEY = "paper:balance";
const TRADES_KEY = "paper:trades";

interface StoreData {
  balance: number;
  trades: PaperTrade[];
}

export async function readStore(): Promise<StoreData> {
  const [balance, trades] = await Promise.all([
    redis.get<number>(BALANCE_KEY),
    redis.lrange<PaperTrade>(TRADES_KEY, 0, -1),
  ]);

  return {
    balance: balance ?? 10000,
    trades: trades ?? [],
  };
}

export async function writeStore(data: StoreData) {
  const pipeline = redis.pipeline();
  pipeline.set(BALANCE_KEY, data.balance);
  pipeline.del(TRADES_KEY);
  if (data.trades.length > 0) {
    for (const trade of data.trades) {
      pipeline.rpush(TRADES_KEY, trade);
    }
  }
  await pipeline.exec();
}

export async function addTrade(
  trade: Omit<PaperTrade, "id" | "created_at" | "settled_at" | "settled_price" | "pnl" | "status">
): Promise<PaperTrade> {
  const newTrade: PaperTrade = {
    ...trade,
    id: crypto.randomUUID(),
    status: "open",
    settled_price: null,
    pnl: null,
    settled_at: null,
    created_at: new Date().toISOString(),
  };

  const balance = (await redis.get<number>(BALANCE_KEY)) ?? 10000;
  const pipeline = redis.pipeline();
  pipeline.set(BALANCE_KEY, balance - trade.cost);
  pipeline.lpush(TRADES_KEY, newTrade);
  await pipeline.exec();

  return newTrade;
}

export async function updateTrade(id: string, updates: Partial<PaperTrade>) {
  const trades = (await redis.lrange<PaperTrade>(TRADES_KEY, 0, -1)) ?? [];
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const updated = { ...trades[idx], ...updates };
  trades[idx] = updated;

  const pipeline = redis.pipeline();
  pipeline.del(TRADES_KEY);
  for (const t of trades) {
    pipeline.rpush(TRADES_KEY, t);
  }
  await pipeline.exec();

  return updated;
}

export async function resetStore(): Promise<number> {
  const trades = (await redis.lrange<PaperTrade>(TRADES_KEY, 0, -1)) ?? [];
  const count = trades.length;
  const pipeline = redis.pipeline();
  pipeline.set(BALANCE_KEY, 10000);
  pipeline.del(TRADES_KEY);
  await pipeline.exec();
  return count;
}

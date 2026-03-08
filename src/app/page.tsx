"use client";

import PaperTrading from "@/components/PaperTrading";
import { TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="bg-accent p-2 rounded-lg text-background">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-text-primary">
              TradeDecoder
            </h1>
            <p className="text-text-tertiary text-xs">
              AI Paper Trading on Kalshi Markets
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <PaperTrading />
      </main>
    </div>
  );
}

"use client";

import PaperTrading from "@/components/PaperTrading";
import { TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-lg text-white">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              TradeDecoder
            </h1>
            <p className="text-gray-400 text-xs">
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

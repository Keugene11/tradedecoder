"use client";

import { useState, useEffect, useCallback } from "react";
import type { TradeAnalysis, MarketData } from "@/types";
import TradeCard from "./TradeCard";
import MarketTable from "./MarketTable";
import {
  Zap,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Filter,
  Loader2,
} from "lucide-react";

type Tab = "recommendations" | "markets";
type RecFilter = "ALL" | "STRONG_BUY" | "BUY" | "HOLD" | "AVOID";

export default function AnalysisDashboard() {
  const [tab, setTab] = useState<Tab>("recommendations");
  const [analyses, setAnalyses] = useState<TradeAnalysis[]>([]);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecFilter>("ALL");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/markets");
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();
      setMarkets(data.markets);
      setLastUpdated(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalyses(data.analyses);
      setTab("recommendations");
      setLastUpdated(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const filteredAnalyses =
    filter === "ALL"
      ? analyses
      : analyses.filter((a) => a.recommendation === filter);

  const stats = {
    strongBuy: analyses.filter((a) => a.recommendation === "STRONG_BUY")
      .length,
    buy: analyses.filter((a) => a.recommendation === "BUY").length,
    hold: analyses.filter((a) => a.recommendation === "HOLD").length,
    avoid: analyses.filter((a) => a.recommendation === "AVOID").length,
    avgConfidence:
      analyses.length > 0
        ? Math.round(
            analyses.reduce((sum, a) => sum + a.confidence, 0) /
              analyses.length
          )
        : 0,
    avgReturn:
      analyses.length > 0
        ? (
            analyses.reduce((sum, a) => sum + a.potential_return_pct, 0) /
            analyses.length
          ).toFixed(1)
        : "0",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TradeDecoder</h1>
              <p className="text-zinc-500 text-xs">
                AI-Powered Kalshi Trade Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-zinc-500 text-xs hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchMarkets}
              disabled={loading}
              className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Analyze Markets
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-900/50 text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Stats Bar */}
        {analyses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-emerald-400 text-2xl font-bold">
                {stats.strongBuy}
              </p>
              <p className="text-zinc-500 text-xs mt-1">Strong Buy</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-green-400 text-2xl font-bold">{stats.buy}</p>
              <p className="text-zinc-500 text-xs mt-1">Buy</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-yellow-400 text-2xl font-bold">{stats.hold}</p>
              <p className="text-zinc-500 text-xs mt-1">Hold</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-red-400 text-2xl font-bold">{stats.avoid}</p>
              <p className="text-zinc-500 text-xs mt-1">Avoid</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-cyan-400 text-2xl font-bold">
                {stats.avgConfidence}%
              </p>
              <p className="text-zinc-500 text-xs mt-1">Avg Confidence</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-blue-400 text-2xl font-bold">
                {stats.avgReturn}%
              </p>
              <p className="text-zinc-500 text-xs mt-1">Avg Return</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-zinc-800">
          <button
            onClick={() => setTab("recommendations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "recommendations"
                ? "border-cyan-500 text-white"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <Zap size={16} />
            AI Recommendations
            {analyses.length > 0 && (
              <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full">
                {analyses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("markets")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "markets"
                ? "border-cyan-500 text-white"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <BarChart3 size={16} />
            All Markets
            {markets.length > 0 && (
              <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                {markets.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {tab === "recommendations" && (
          <>
            {analyses.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Filter size={14} className="text-zinc-500" />
                {(
                  ["ALL", "STRONG_BUY", "BUY", "HOLD", "AVOID"] as RecFilter[]
                ).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      filter === f
                        ? "bg-cyan-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {f.replace("_", " ")}
                  </button>
                ))}
              </div>
            )}

            {analyses.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 max-w-md mx-auto">
                  <Zap size={48} className="text-zinc-600 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">
                    Ready to Analyze
                  </h2>
                  <p className="text-zinc-400 text-sm mb-6">
                    Click &quot;Analyze Markets&quot; to scan Kalshi for the most
                    profitable trading opportunities using AI analysis.
                  </p>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-all cursor-pointer"
                  >
                    {analyzing ? "Analyzing..." : "Start Analysis"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredAnalyses.map((analysis) => (
                  <TradeCard key={analysis.ticker} analysis={analysis} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "markets" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-zinc-500" />
              </div>
            ) : (
              <MarketTable markets={markets} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TradeAnalysis, MarketData } from "@/types";
import TradeCard from "./TradeCard";
import MarketTable from "./MarketTable";
import PaperTrading from "./PaperTrading";
import {
  Zap,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Filter,
  Loader2,
  Bot,
} from "lucide-react";

type Tab = "recommendations" | "markets" | "paper-trading";
type RecFilter = "ALL" | "STRONG_BUY" | "BUY";

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
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markets: markets.slice(0, 10) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Analysis failed");
      }
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
    total: analyses.length,
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg text-white">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">TradeDecoder</h1>
              <p className="text-gray-400 text-xs">
                AI-Powered Kalshi Trade Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-gray-400 text-xs hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchMarkets}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-900 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/20"
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
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Stats Bar */}
        {analyses.length > 0 && tab === "recommendations" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-emerald-600 text-2xl font-bold">
                {stats.strongBuy}
              </p>
              <p className="text-gray-400 text-xs mt-1">Strong Buy</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-green-600 text-2xl font-bold">{stats.buy}</p>
              <p className="text-gray-400 text-xs mt-1">Buy</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-gray-900 text-2xl font-bold">{stats.total}</p>
              <p className="text-gray-400 text-xs mt-1">Total Picks</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-blue-600 text-2xl font-bold">
                {stats.avgConfidence}%
              </p>
              <p className="text-gray-400 text-xs mt-1">Avg Confidence</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-indigo-600 text-2xl font-bold">
                {stats.avgReturn}%
              </p>
              <p className="text-gray-400 text-xs mt-1">Avg Return</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setTab("recommendations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "recommendations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <Zap size={16} />
            Best Bets
            {analyses.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                {analyses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("markets")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "markets"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <BarChart3 size={16} />
            All Markets
            {markets.length > 0 && (
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                {markets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("paper-trading")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "paper-trading"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <Bot size={16} />
            Paper Trading
          </button>
        </div>

        {/* Content */}
        {tab === "recommendations" && (
          <>
            {analyses.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Filter size={14} className="text-gray-400" />
                {(["ALL", "STRONG_BUY", "BUY"] as RecFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      filter === f
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    {f.replace("_", " ")}
                  </button>
                ))}
              </div>
            )}

            {analyses.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-white border border-gray-200 rounded-2xl p-12 max-w-md mx-auto shadow-sm">
                  <Zap size={48} className="text-gray-300 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2 text-gray-900">
                    Ready to Find Bets
                  </h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Click &quot;Analyze Markets&quot; to scan Kalshi for the most
                    profitable bets using AI analysis.
                  </p>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-lg transition-all cursor-pointer shadow-md shadow-blue-500/20"
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
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <MarketTable markets={markets} />
            )}
          </div>
        )}

        {tab === "paper-trading" && <PaperTrading />}
      </main>
    </div>
  );
}

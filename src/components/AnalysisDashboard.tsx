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
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-lg text-background">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-[-0.02em] text-text-primary">TradeDecoder</h1>
              <p className="text-text-tertiary text-xs">
                AI-Powered Kalshi Trade Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-text-tertiary text-xs hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchMarkets}
              disabled={loading}
              className="p-2 rounded-lg border border-border hover:border-border-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-background font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
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
          <div className="mb-6 bg-loss/10 border border-loss/30 text-loss rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {analyses.length > 0 && tab === "recommendations" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-gain text-2xl font-bold">
                {stats.strongBuy}
              </p>
              <p className="text-text-tertiary text-xs mt-1">Strong Buy</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-gain/80 text-2xl font-bold">{stats.buy}</p>
              <p className="text-text-tertiary text-xs mt-1">Buy</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-text-primary text-2xl font-bold">{stats.total}</p>
              <p className="text-text-tertiary text-xs mt-1">Total Picks</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-info text-2xl font-bold">
                {stats.avgConfidence}%
              </p>
              <p className="text-text-tertiary text-xs mt-1">Avg Confidence</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-accent text-2xl font-bold">
                {stats.avgReturn}%
              </p>
              <p className="text-text-tertiary text-xs mt-1">Avg Return</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setTab("recommendations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "recommendations"
                ? "border-accent text-accent"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Zap size={16} />
            Best Bets
            {analyses.length > 0 && (
              <span className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded-full">
                {analyses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("markets")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "markets"
                ? "border-accent text-accent"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <BarChart3 size={16} />
            All Markets
            {markets.length > 0 && (
              <span className="bg-surface-raised text-text-secondary text-xs px-2 py-0.5 rounded-full">
                {markets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("paper-trading")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
              tab === "paper-trading"
                ? "border-accent text-accent"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Bot size={16} />
            Paper Trading
          </button>
        </div>

        {tab === "recommendations" && (
          <>
            {analyses.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Filter size={14} className="text-text-tertiary" />
                {(["ALL", "STRONG_BUY", "BUY"] as RecFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      filter === f
                        ? "bg-accent text-background"
                        : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-hover"
                    }`}
                  >
                    {f.replace("_", " ")}
                  </button>
                ))}
              </div>
            )}

            {analyses.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-surface border border-border rounded-2xl p-12 max-w-md mx-auto">
                  <Zap size={48} className="text-text-tertiary mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2 text-text-primary tracking-[-0.01em]">
                    Ready to Find Bets
                  </h2>
                  <p className="text-text-secondary text-sm mb-6">
                    Click &quot;Analyze Markets&quot; to scan Kalshi for the most
                    profitable bets using AI analysis.
                  </p>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="bg-accent hover:bg-accent-hover text-background font-semibold px-6 py-3 rounded-lg transition-all cursor-pointer"
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
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-text-tertiary" />
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

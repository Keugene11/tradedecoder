"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaperTrade, PortfolioStats } from "@/types";
import PnlChart from "./PnlChart";
import {
  Bot,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  RefreshCw,
  Loader2,
  Trophy,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";

const ANON_USER_ID = "00000000-0000-0000-0000-000000000000";

export default function PaperTrading() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoTrading, setAutoTrading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/paper-trade?user_id=${ANON_USER_ID}`);
      const data = await res.json();
      setTrades(data.trades || []);
      setStats(data.stats || null);
    } catch {
      console.error("Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const runAutoTrade = async () => {
    setAutoTrading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/paper-trade/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: ANON_USER_ID }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(`Error: ${data.error}`);
      } else if (data.trades_placed === 0) {
        setMessage(
          `Analyzed ${data.analyses_count} markets — no trades met the STRONG_BUY criteria right now.`
        );
      } else {
        setMessage(
          `AI placed ${data.trades_placed} trade${data.trades_placed > 1 ? "s" : ""} totaling $${data.total_cost.toFixed(2)}`
        );
        fetchTrades();
      }
    } catch {
      setMessage("Auto-trade request failed");
    } finally {
      setAutoTrading(false);
    }
  };

  const settleTrades = async () => {
    setSettling(true);
    try {
      const res = await fetch("/api/paper-trade/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: ANON_USER_ID }),
      });
      const data = await res.json();
      if (data.settled > 0) {
        setMessage(
          `Settled ${data.settled} trade${data.settled > 1 ? "s" : ""}`
        );
        fetchTrades();
      } else {
        setMessage("No trades ready to settle yet");
      }
    } catch {
      setMessage("Settlement failed");
    } finally {
      setSettling(false);
    }
  };

  const openTrades = trades.filter((t) => t.status === "open");
  const settledTrades = trades.filter((t) => t.status !== "open");

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <StatCard
            label="Balance"
            value={`$${stats.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={18} />}
            color="blue"
          />
          <StatCard
            label="Invested"
            value={`$${stats.total_invested.toFixed(2)}`}
            icon={<Target size={18} />}
            color="indigo"
          />
          <StatCard
            label="Total P&L"
            value={`${stats.total_pnl >= 0 ? "+" : ""}$${stats.total_pnl.toFixed(2)}`}
            icon={
              stats.total_pnl >= 0 ? (
                <TrendingUp size={18} />
              ) : (
                <TrendingDown size={18} />
              )
            }
            color={stats.total_pnl >= 0 ? "emerald" : "red"}
          />
          <StatCard
            label="Win Rate"
            value={`${stats.win_rate}%`}
            icon={<Trophy size={18} />}
            color="amber"
          />
          <StatCard
            label="Open"
            value={String(stats.open_trades)}
            icon={<Clock size={18} />}
            color="sky"
          />
          <StatCard
            label="Settled"
            value={String(stats.total_trades)}
            icon={<Target size={18} />}
            color="gray"
          />
        </div>
      )}

      {/* P&L Chart */}
      {trades.length > 0 && <PnlChart trades={trades} startingBalance={10000} />}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={runAutoTrade}
          disabled={autoTrading}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-violet-500/20"
        >
          {autoTrading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              AI Analyzing...
            </>
          ) : (
            <>
              <Bot size={18} />
              AI Auto-Trade
            </>
          )}
        </button>
        <button
          onClick={settleTrades}
          disabled={settling || openTrades.length === 0}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 text-sm"
        >
          {settling ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Settle Trades
        </button>
        <button
          onClick={fetchTrades}
          disabled={loading}
          className="p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-3 text-sm">
          <AlertCircle size={16} />
          {message}
        </div>
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Open Positions ({openTrades.length})
          </h3>
          <div className="space-y-2">
            {openTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}

      {/* Settled Trades */}
      {settledTrades.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Trade History ({settledTrades.length})
          </h3>
          <div className="space-y-2">
            {settledTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 && !loading && (
        <div className="text-center py-12">
          <Bot size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            No trades yet. Click &quot;AI Auto-Trade&quot; to let the AI analyze
            markets and place bets.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
    gray: "text-gray-600",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className={`${colorMap[color] || "text-gray-600"} mb-1`}>
        {icon}
      </div>
      <p className={`text-xl font-bold ${colorMap[color] || "text-gray-900"}`}>
        {value}
      </p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function TradeRow({ trade }: { trade: PaperTrade }) {
  const isOpen = trade.status === "open";
  const isWin = trade.status === "settled_win";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isOpen
            ? "bg-blue-500 animate-pulse"
            : isWin
              ? "bg-emerald-500"
              : "bg-red-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">
            {trade.title}
          </span>
          {trade.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
              {trade.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span className="font-mono">{trade.ticker}</span>
          <span
            className={`font-semibold ${
              trade.position === "YES" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {trade.position}
          </span>
          <span>
            {trade.quantity}x @ ${trade.entry_price.toFixed(2)}
          </span>
          <span>Cost: ${trade.cost.toFixed(2)}</span>
          {trade.confidence && (
            <span className="text-blue-500">{trade.confidence}% conf</span>
          )}
        </div>
        {trade.ai_reasoning && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">
            {trade.ai_reasoning}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {isOpen ? (
          <span className="text-xs font-medium text-blue-500 flex items-center gap-1">
            <Clock size={12} /> Open
          </span>
        ) : (
          <div className="flex items-center gap-1">
            {isWin ? (
              <ArrowUpRight size={16} className="text-emerald-500" />
            ) : (
              <ArrowDownRight size={16} className="text-red-500" />
            )}
            <span
              className={`font-bold text-sm ${
                (trade.pnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {(trade.pnl || 0) >= 0 ? "+" : ""}$
              {(trade.pnl || 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

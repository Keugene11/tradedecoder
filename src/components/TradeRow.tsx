"use client";

import { useState } from "react";
import type { PaperTrade } from "@/types";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Target,
  Brain,
} from "lucide-react";

function formatTimeUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "Resolving soon";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TradeRow({ trade }: { trade: PaperTrade }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = trade.status === "open";
  const isWin = trade.status === "settled_win";

  const potentialProfit = (1 - trade.entry_price) * trade.quantity;
  const potentialReturnPct = (
    ((1 - trade.entry_price) / trade.entry_price) *
    100
  ).toFixed(0);

  return (
    <div
      className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
        expanded ? "border-blue-200 ring-1 ring-blue-100" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-4 cursor-pointer"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
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
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span
              className={`font-semibold ${
                trade.position === "YES"
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {trade.position}
            </span>
            <span>
              {trade.quantity}x @ ${trade.entry_price.toFixed(2)}
            </span>
            <span>Cost: ${trade.cost.toFixed(2)}</span>
            {trade.confidence && (
              <span className="text-blue-500">
                {trade.confidence}% conf
              </span>
            )}
            {isOpen && trade.close_time && (
              <span className="text-amber-500 flex items-center gap-1">
                <Clock size={10} />
                {formatTimeUntil(trade.close_time)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
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
                    (trade.pnl || 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {(trade.pnl || 0) >= 0 ? "+" : ""}$
                  {(trade.pnl || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div
            className={`p-1 rounded transition-colors ${
              expanded ? "bg-blue-50" : "bg-gray-50"
            }`}
          >
            {expanded ? (
              <ChevronUp
                size={16}
                className={expanded ? "text-blue-500" : "text-gray-400"}
              />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3 bg-gray-50/50">
          {/* Trade details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Position
              </p>
              <p
                className={`text-sm font-bold ${
                  trade.position === "YES"
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {trade.position} x{trade.quantity}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Entry Price
              </p>
              <p className="text-sm font-bold text-gray-900">
                ${trade.entry_price.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Total Cost
              </p>
              <p className="text-sm font-bold text-gray-900">
                ${trade.cost.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                {isOpen ? "Potential Profit" : "Result"}
              </p>
              {isOpen ? (
                <p className="text-sm font-bold text-emerald-600">
                  +${potentialProfit.toFixed(2)} ({potentialReturnPct}%)
                </p>
              ) : (
                <p
                  className={`text-sm font-bold ${
                    (trade.pnl || 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {(trade.pnl || 0) >= 0 ? "+" : ""}$
                  {(trade.pnl || 0).toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              <span>Placed: {formatDate(trade.created_at)}</span>
            </div>
            {trade.close_time && (
              <div className="flex items-center gap-1.5">
                <Clock
                  size={13}
                  className={isOpen ? "text-amber-500" : "text-gray-400"}
                />
                <span
                  className={isOpen ? "text-amber-600 font-medium" : ""}
                >
                  Resolves: {formatDate(trade.close_time)}
                  {isOpen && ` (${formatTimeUntil(trade.close_time)})`}
                </span>
              </div>
            )}
            {trade.settled_at && (
              <div className="flex items-center gap-1.5">
                <Target size={13} className="text-gray-400" />
                <span>Settled: {formatDate(trade.settled_at)}</span>
              </div>
            )}
          </div>

          {/* Ticker */}
          <div className="text-xs font-mono text-gray-400">
            {trade.ticker}
          </div>

          {/* AI Reasoning */}
          {trade.ai_reasoning && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain size={14} className="text-indigo-500" />
                <span className="text-xs font-semibold text-indigo-600">
                  AI Analysis
                </span>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
                {trade.ai_reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

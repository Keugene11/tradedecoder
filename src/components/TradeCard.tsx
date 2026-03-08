"use client";

import { useState } from "react";
import type { TradeAnalysis } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  DollarSign,
  BarChart3,
  Shield,
} from "lucide-react";

const recColors: Record<string, string> = {
  STRONG_BUY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  BUY: "bg-green-500/20 text-green-400 border-green-500/30",
  HOLD: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  AVOID: "bg-red-500/20 text-red-400 border-red-500/30",
};

const riskColors: Record<string, string> = {
  LOW: "text-green-400",
  MEDIUM: "text-yellow-400",
  HIGH: "text-red-400",
};

export default function TradeCard({ analysis }: { analysis: TradeAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg leading-tight truncate">
            {analysis.title}
          </h3>
          <p className="text-zinc-500 text-sm font-mono mt-1">
            {analysis.ticker}
          </p>
        </div>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-sm font-bold border ${recColors[analysis.recommendation]}`}
        >
          {analysis.recommendation.replace("_", " ")}
        </span>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Target size={12} />
            Position
          </div>
          <p
            className={`font-bold text-lg ${
              analysis.target_position === "YES"
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {analysis.target_position}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <DollarSign size={12} />
            Entry
          </div>
          <p className="font-bold text-lg text-white">
            ${analysis.entry_price.toFixed(2)}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <BarChart3 size={12} />
            Return
          </div>
          <p
            className={`font-bold text-lg ${
              analysis.potential_return_pct > 0
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {analysis.potential_return_pct > 0 ? "+" : ""}
            {analysis.potential_return_pct.toFixed(0)}%
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Shield size={12} />
            Risk
          </div>
          <p className={`font-bold text-lg ${riskColors[analysis.risk_level]}`}>
            {analysis.risk_level}
          </p>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Confidence</span>
          <span>{analysis.confidence}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all"
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <p className="text-zinc-300 text-sm leading-relaxed mb-4">
        {analysis.summary}
      </p>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white text-sm py-2 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all cursor-pointer"
      >
        {expanded ? (
          <>
            Hide Details <ChevronUp size={16} />
          </>
        ) : (
          <>
            Show Pros & Cons <ChevronDown size={16} />
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pros */}
          <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-3">
              <TrendingUp size={16} />
              Why It Could Win
            </h4>
            <ul className="space-y-2">
              {analysis.pros.map((pro, i) => (
                <li
                  key={i}
                  className="text-zinc-300 text-sm flex items-start gap-2"
                >
                  <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>

          {/* Cons */}
          <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-3">
              <TrendingDown size={16} />
              Why It Could Lose
            </h4>
            <ul className="space-y-2">
              {analysis.cons.map((con, i) => (
                <li
                  key={i}
                  className="text-zinc-300 text-sm flex items-start gap-2"
                >
                  <span className="text-red-500 mt-0.5 shrink-0">-</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

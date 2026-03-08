"use client";

import { useState } from "react";
import type { TradeAnalysis } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Target,
  DollarSign,
  BarChart3,
  Shield,
  Info,
  CircleDollarSign,
  Tag,
  Calculator,
} from "lucide-react";

const recColors: Record<string, string> = {
  STRONG_BUY: "bg-emerald-100 text-emerald-700 border-emerald-300",
  BUY: "bg-green-100 text-green-700 border-green-300",
  HOLD: "bg-amber-100 text-amber-700 border-amber-300",
};

const riskColors: Record<string, string> = {
  LOW: "text-green-600",
  MEDIUM: "text-amber-600",
  HIGH: "text-red-600",
};

const categoryColors: Record<string, string> = {
  "NBA Basketball": "bg-orange-100 text-orange-700",
  "NHL Hockey": "bg-sky-100 text-sky-700",
  "NFL Football": "bg-green-100 text-green-700",
  "MLB Baseball": "bg-red-100 text-red-700",
  "NCAA Men's Basketball": "bg-amber-100 text-amber-700",
  "NCAA Women's Basketball": "bg-pink-100 text-pink-700",
  "UFC / MMA": "bg-red-100 text-red-700",
  "Economics": "bg-violet-100 text-violet-700",
  "Politics": "bg-blue-100 text-blue-700",
  "Weather": "bg-cyan-100 text-cyan-700",
  "Crypto": "bg-yellow-100 text-yellow-700",
  "World Baseball Classic": "bg-indigo-100 text-indigo-700",
};

function EdgeBar({ implied, estimated }: { implied: number; estimated: number }) {
  const edge = estimated - implied;
  const edgeColor = edge > 10 ? "text-emerald-600" : edge > 5 ? "text-green-600" : "text-amber-600";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Market says</span>
        <span className="text-gray-500">You estimate</span>
      </div>
      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
        {/* Implied prob bar */}
        <div
          className="absolute inset-y-0 left-0 bg-gray-300 rounded-full"
          style={{ width: `${Math.min(implied, 100)}%` }}
        />
        {/* Estimated true prob bar */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full opacity-80"
          style={{ width: `${Math.min(estimated, 100)}%` }}
        />
        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
          <span className="text-white drop-shadow">{implied.toFixed(0)}%</span>
          <span className={`font-bold ${edgeColor}`}>+{edge.toFixed(1)}% edge</span>
          <span className="text-white drop-shadow">{estimated.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold font-mono ${color || "text-gray-900"}`}>{value}</p>
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

export default function TradeCard({ analysis }: { analysis: TradeAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const math = analysis.math_breakdown;
  const catColor = categoryColors[analysis.category] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-gray-300 transition-all">
      {/* Category + Recommendation badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {analysis.category && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${catColor}`}>
            <Tag size={11} />
            {analysis.category}
          </span>
        )}
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${recColors[analysis.recommendation] || recColors.BUY}`}
        >
          {analysis.recommendation.replace("_", " ")}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-gray-900 font-bold text-lg leading-tight mb-1">
        {analysis.title}
      </h3>
      <p className="text-gray-400 text-xs font-mono mb-4">
        {analysis.ticker}
      </p>

      {/* What's happening */}
      {analysis.event_description && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-blue-700 font-semibold text-xs uppercase tracking-wide mb-1.5">
            <Info size={13} />
            What&apos;s Happening
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            {analysis.event_description}
          </p>
        </div>
      )}

      {/* The Bet */}
      {analysis.the_bet && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-indigo-700 font-semibold text-xs uppercase tracking-wide mb-1.5">
            <Target size={13} />
            The Bet
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed font-medium">
            {analysis.the_bet}
          </p>
        </div>
      )}

      {/* How you profit */}
      {analysis.how_you_profit && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs uppercase tracking-wide mb-1.5">
            <CircleDollarSign size={13} />
            How You Make Money
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            {analysis.how_you_profit}
          </p>
        </div>
      )}

      {/* Math Breakdown */}
      {math && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="flex items-center gap-1.5 text-gray-800 font-semibold text-xs uppercase tracking-wide mb-3">
            <Calculator size={13} />
            Math Breakdown
          </h4>

          {/* Edge visualization */}
          <EdgeBar
            implied={math.implied_prob_pct}
            estimated={math.estimated_true_prob_pct}
          />

          {/* Stats grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-gray-200">
            <StatBox
              label="You Pay"
              value={`$${math.cost_per_contract?.toFixed(2) || analysis.entry_price.toFixed(2)}`}
            />
            <StatBox
              label="Win Profit"
              value={`+$${math.profit_if_win?.toFixed(2) || (1 - analysis.entry_price).toFixed(2)}`}
              color="text-emerald-600"
            />
            <StatBox
              label="If You Lose"
              value={`-$${math.loss_if_lose?.toFixed(2) || analysis.entry_price.toFixed(2)}`}
              color="text-red-600"
            />
            <StatBox
              label="EV / Dollar"
              value={`${math.expected_value_per_dollar > 0 ? "+" : ""}${(math.expected_value_per_dollar * 100).toFixed(1)}c`}
              sub="per $1 bet"
              color={math.expected_value_per_dollar > 0 ? "text-emerald-600" : "text-red-600"}
            />
            <StatBox
              label="Kelly Size"
              value={`${math.kelly_fraction_pct?.toFixed(1) || 0}%`}
              sub="of bankroll"
              color="text-blue-600"
            />
          </div>

          {/* Break-even line */}
          <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <span>Break-even: need {math.break_even_prob_pct?.toFixed(0) || 50}% win rate</span>
            <span className="font-medium text-gray-700">
              Edge: {math.edge_pct > 0 ? "+" : ""}{math.edge_pct?.toFixed(1)}% above break-even
            </span>
          </div>
        </div>
      )}

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
            <Target size={12} />
            Position
          </div>
          <p className={`font-bold text-lg ${analysis.target_position === "YES" ? "text-emerald-600" : "text-red-600"}`}>
            {analysis.target_position}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
            <DollarSign size={12} />
            Entry Price
          </div>
          <p className="font-bold text-lg text-gray-900">
            ${analysis.entry_price.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
            <BarChart3 size={12} />
            Potential Return
          </div>
          <p className={`font-bold text-lg ${analysis.potential_return_pct > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {analysis.potential_return_pct > 0 ? "+" : ""}
            {analysis.potential_return_pct.toFixed(0)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
            <Shield size={12} />
            Risk Level
          </div>
          <p className={`font-bold text-lg ${riskColors[analysis.risk_level]}`}>
            {analysis.risk_level}
          </p>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>AI Confidence</span>
          <span>{analysis.confidence}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>
      </div>

      {/* AI Analysis Summary */}
      <div className="mb-4">
        <h4 className="text-gray-900 font-semibold text-sm mb-1.5">AI Analysis</h4>
        <p className="text-gray-600 text-sm leading-relaxed">
          {analysis.summary}
        </p>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-900 text-sm py-2.5 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer"
      >
        {expanded ? (
          <>Hide Detailed Pros & Cons <ChevronUp size={16} /></>
        ) : (
          <>Show Detailed Pros & Cons <ChevronDown size={16} /></>
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-3">
              <TrendingUp size={16} />
              Why This Bet Wins
            </h4>
            <ul className="space-y-3">
              {analysis.pros.map((pro, i) => (
                <li key={i} className="text-gray-700 text-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-emerald-600 mt-0.5 shrink-0 font-bold">+</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-3">
              <TrendingDown size={16} />
              What Could Go Wrong
            </h4>
            <ul className="space-y-3">
              {analysis.cons.map((con, i) => (
                <li key={i} className="text-gray-700 text-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-red-600 mt-0.5 shrink-0 font-bold">-</span>
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

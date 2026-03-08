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
  STRONG_BUY: "bg-gain/15 text-gain border-gain/30",
  BUY: "bg-gain/10 text-gain/80 border-gain/20",
  HOLD: "bg-warning/15 text-warning border-warning/30",
};

const riskColors: Record<string, string> = {
  LOW: "text-gain",
  MEDIUM: "text-warning",
  HIGH: "text-loss",
};

const categoryColors: Record<string, string> = {
  "NBA Basketball": "bg-surface-raised text-text-secondary",
  "NHL Hockey": "bg-surface-raised text-text-secondary",
  "NFL Football": "bg-surface-raised text-text-secondary",
  "MLB Baseball": "bg-surface-raised text-text-secondary",
  "NCAA Men's Basketball": "bg-surface-raised text-text-secondary",
  "NCAA Women's Basketball": "bg-surface-raised text-text-secondary",
  "UFC / MMA": "bg-surface-raised text-text-secondary",
  "Economics": "bg-surface-raised text-text-secondary",
  "Politics": "bg-surface-raised text-text-secondary",
  "Weather": "bg-surface-raised text-text-secondary",
  "Crypto": "bg-surface-raised text-text-secondary",
  "World Baseball Classic": "bg-surface-raised text-text-secondary",
};

function EdgeBar({ implied, estimated }: { implied: number; estimated: number }) {
  const edge = estimated - implied;
  const edgeColor = edge > 10 ? "text-gain" : edge > 5 ? "text-gain/80" : "text-warning";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-tertiary">Market says</span>
        <span className="text-text-tertiary">You estimate</span>
      </div>
      <div className="relative h-6 bg-surface-raised rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-text-tertiary/30 rounded-full"
          style={{ width: `${Math.min(implied, 100)}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-info/60 to-gain/60 rounded-full opacity-80"
          style={{ width: `${Math.min(estimated, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
          <span className="text-text-primary drop-shadow">{implied.toFixed(0)}%</span>
          <span className={`font-bold ${edgeColor}`}>+{edge.toFixed(1)}% edge</span>
          <span className="text-text-primary drop-shadow">{estimated.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold font-mono ${color || "text-text-primary"}`}>{value}</p>
      <p className="text-[11px] text-text-tertiary leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-text-tertiary">{sub}</p>}
    </div>
  );
}

export default function TradeCard({ analysis }: { analysis: TradeAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const math = analysis.math_breakdown;
  const catColor = categoryColors[analysis.category] || "bg-surface-raised text-text-secondary";

  return (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-border-hover transition-all">
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

      <h3 className="text-text-primary font-bold text-lg leading-tight mb-1 tracking-[-0.01em]">
        {analysis.title}
      </h3>
      <p className="text-text-tertiary text-xs font-mono mb-4">
        {analysis.ticker}
      </p>

      {analysis.event_description && (
        <div className="bg-surface-raised border border-border rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-info font-semibold text-xs uppercase tracking-wide mb-1.5">
            <Info size={13} />
            What&apos;s Happening
          </h4>
          <p className="text-text-secondary text-sm leading-relaxed">
            {analysis.event_description}
          </p>
        </div>
      )}

      {analysis.the_bet && (
        <div className="bg-surface-raised border border-border rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-accent font-semibold text-xs uppercase tracking-wide mb-1.5">
            <Target size={13} />
            The Bet
          </h4>
          <p className="text-text-secondary text-sm leading-relaxed font-medium">
            {analysis.the_bet}
          </p>
        </div>
      )}

      {analysis.how_you_profit && (
        <div className="bg-gain/5 border border-gain/15 rounded-lg p-3.5 mb-4">
          <h4 className="flex items-center gap-1.5 text-gain font-semibold text-xs uppercase tracking-wide mb-1.5">
            <CircleDollarSign size={13} />
            How You Make Money
          </h4>
          <p className="text-text-secondary text-sm leading-relaxed">
            {analysis.how_you_profit}
          </p>
        </div>
      )}

      {math && (
        <div className="bg-surface-raised border border-border rounded-lg p-4 mb-4">
          <h4 className="flex items-center gap-1.5 text-text-secondary font-semibold text-xs uppercase tracking-wide mb-3">
            <Calculator size={13} />
            Math Breakdown
          </h4>

          <EdgeBar
            implied={math.implied_prob_pct}
            estimated={math.estimated_true_prob_pct}
          />

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-border">
            <StatBox
              label="You Pay"
              value={`$${math.cost_per_contract?.toFixed(2) || analysis.entry_price.toFixed(2)}`}
            />
            <StatBox
              label="Win Profit"
              value={`+$${math.profit_if_win?.toFixed(2) || (1 - analysis.entry_price).toFixed(2)}`}
              color="text-gain"
            />
            <StatBox
              label="If You Lose"
              value={`-$${math.loss_if_lose?.toFixed(2) || analysis.entry_price.toFixed(2)}`}
              color="text-loss"
            />
            <StatBox
              label="EV / Dollar"
              value={`${math.expected_value_per_dollar > 0 ? "+" : ""}${(math.expected_value_per_dollar * 100).toFixed(1)}c`}
              sub="per $1 bet"
              color={math.expected_value_per_dollar > 0 ? "text-gain" : "text-loss"}
            />
            <StatBox
              label="Kelly Size"
              value={`${math.kelly_fraction_pct?.toFixed(1) || 0}%`}
              sub="of bankroll"
              color="text-info"
            />
          </div>

          <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs text-text-tertiary">
            <span>Break-even: need {math.break_even_prob_pct?.toFixed(0) || 50}% win rate</span>
            <span className="font-medium text-text-secondary">
              Edge: {math.edge_pct > 0 ? "+" : ""}{math.edge_pct?.toFixed(1)}% above break-even
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface-raised rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-text-tertiary text-xs mb-1">
            <Target size={12} />
            Position
          </div>
          <p className={`font-bold text-lg ${analysis.target_position === "YES" ? "text-gain" : "text-loss"}`}>
            {analysis.target_position}
          </p>
        </div>
        <div className="bg-surface-raised rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-text-tertiary text-xs mb-1">
            <DollarSign size={12} />
            Entry Price
          </div>
          <p className="font-bold text-lg text-text-primary">
            ${analysis.entry_price.toFixed(2)}
          </p>
        </div>
        <div className="bg-surface-raised rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-text-tertiary text-xs mb-1">
            <BarChart3 size={12} />
            Potential Return
          </div>
          <p className={`font-bold text-lg ${analysis.potential_return_pct > 0 ? "text-gain" : "text-loss"}`}>
            {analysis.potential_return_pct > 0 ? "+" : ""}
            {analysis.potential_return_pct.toFixed(0)}%
          </p>
        </div>
        <div className="bg-surface-raised rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-text-tertiary text-xs mb-1">
            <Shield size={12} />
            Risk Level
          </div>
          <p className={`font-bold text-lg ${riskColors[analysis.risk_level]}`}>
            {analysis.risk_level}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-text-tertiary mb-1">
          <span>AI Confidence</span>
          <span>{analysis.confidence}%</span>
        </div>
        <div className="w-full bg-surface-raised rounded-full h-2">
          <div
            className="bg-accent h-2 rounded-full transition-all"
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-text-primary font-semibold text-sm mb-1.5">AI Analysis</h4>
        <p className="text-text-secondary text-sm leading-relaxed">
          {analysis.summary}
        </p>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary text-sm py-2.5 border border-border rounded-lg hover:border-border-hover hover:bg-surface-raised transition-all cursor-pointer"
      >
        {expanded ? (
          <>Hide Detailed Pros & Cons <ChevronUp size={16} /></>
        ) : (
          <>Show Detailed Pros & Cons <ChevronDown size={16} /></>
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gain/5 border border-gain/20 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-gain font-semibold text-sm mb-3">
              <TrendingUp size={16} />
              Why This Bet Wins
            </h4>
            <ul className="space-y-3">
              {analysis.pros.map((pro, i) => (
                <li key={i} className="text-text-secondary text-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-gain mt-0.5 shrink-0 font-bold">+</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-loss/5 border border-loss/20 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-loss font-semibold text-sm mb-3">
              <TrendingDown size={16} />
              What Could Go Wrong
            </h4>
            <ul className="space-y-3">
              {analysis.cons.map((con, i) => (
                <li key={i} className="text-text-secondary text-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-loss mt-0.5 shrink-0 font-bold">-</span>
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

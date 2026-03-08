"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PaperTrade } from "@/types";

interface PnlChartProps {
  trades: PaperTrade[];
  startingBalance: number;
}

export default function PnlChart({ trades, startingBalance }: PnlChartProps) {
  const allTrades = [...trades].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const buckets: { label: string; trades: PaperTrade[] }[] = [];
  let currentBucket: PaperTrade[] = [];
  let bucketStart = 0;

  for (const trade of allTrades) {
    const t = new Date(trade.created_at).getTime();
    if (currentBucket.length === 0) {
      bucketStart = t;
      currentBucket.push(trade);
    } else if (t - bucketStart < 5 * 60 * 1000) {
      currentBucket.push(trade);
    } else {
      const d = new Date(bucketStart);
      buckets.push({
        label: formatTime(d),
        trades: [...currentBucket],
      });
      currentBucket = [trade];
      bucketStart = t;
    }
  }
  if (currentBucket.length > 0) {
    buckets.push({
      label: formatTime(new Date(bucketStart)),
      trades: [...currentBucket],
    });
  }

  const dataPoints: {
    name: string;
    balance: number;
    invested: number;
    trades: number;
  }[] = [];

  dataPoints.push({
    name: "Start",
    balance: startingBalance,
    invested: 0,
    trades: 0,
  });

  let runningBalance = startingBalance;
  let totalInvested = 0;
  let totalTrades = 0;

  for (const bucket of buckets) {
    let bucketCost = 0;
    let bucketReturns = 0;

    for (const trade of bucket.trades) {
      bucketCost += trade.cost;
      totalTrades++;

      if (trade.status !== "open" && trade.pnl !== null) {
        if (trade.status === "settled_win") {
          bucketReturns += trade.quantity * 1;
        } else if (trade.status === "expired") {
          bucketReturns += trade.cost * 0.9;
        }
      }
    }

    totalInvested += bucketCost;
    runningBalance = runningBalance - bucketCost + bucketReturns;

    dataPoints.push({
      name: `${bucket.label} (${bucket.trades.length})`,
      balance: parseFloat(runningBalance.toFixed(2)),
      invested: parseFloat(totalInvested.toFixed(2)),
      trades: totalTrades,
    });
  }

  const openValue = allTrades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => sum + t.cost, 0);
  const portfolioValue = runningBalance + openValue;

  const minVal = Math.min(
    ...dataPoints.map((d) => d.balance),
    portfolioValue
  );
  const maxVal = Math.max(startingBalance, portfolioValue);
  const totalPnl = portfolioValue - startingBalance;
  const pnlColor = totalPnl >= 0 ? "#00D632" : "#FF5A4F";

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-secondary">
            Portfolio Overview
          </h3>
          <p className="text-3xl font-bold text-text-primary tracking-[-0.02em]">
            $
            {portfolioValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            ${runningBalance.toFixed(2)} cash + ${openValue.toFixed(2)} in open
            bets
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-text-tertiary">Invested</p>
              <p className="text-sm font-bold text-info">
                ${totalInvested.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Trades</p>
              <p className="text-sm font-bold text-text-primary">{totalTrades}</p>
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={dataPoints}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={pnlColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#555555" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[
              Math.floor(minVal * 0.98),
              Math.ceil(maxVal * 1.01),
            ]}
            tick={{ fontSize: 10, fill: "#555555" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1C1C1C",
              border: "1px solid #2A2A2A",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#FAFAFA",
            }}
            formatter={(value, name) => {
              const v = Number(value);
              const label =
                name === "balance"
                  ? "Cash Balance"
                  : name === "invested"
                    ? "Total Invested"
                    : "Trades";
              return name === "trades"
                ? [v, label]
                : [
                    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    label,
                  ];
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={pnlColor}
            strokeWidth={2}
            fill="url(#balGrad)"
            name="balance"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
  // Build cumulative P&L data points from trades sorted by time
  const allTrades = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const dataPoints: { time: string; balance: number; pnl: number }[] = [
    {
      time: "Start",
      balance: startingBalance,
      pnl: 0,
    },
  ];

  let runningBalance = startingBalance;
  let runningPnl = 0;

  for (const trade of allTrades) {
    const date = new Date(trade.created_at);
    const timeLabel = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

    // Deduct cost when trade is placed
    runningBalance -= trade.cost;
    dataPoints.push({
      time: timeLabel,
      balance: parseFloat(runningBalance.toFixed(2)),
      pnl: parseFloat(runningPnl.toFixed(2)),
    });

    // If settled, add the result
    if (trade.status !== "open" && trade.pnl !== null) {
      runningPnl += trade.pnl;
      // Win: get back $1 per contract. Loss: already deducted
      if (trade.status === "settled_win") {
        runningBalance += trade.quantity * 1;
      } else if (trade.status === "expired") {
        runningBalance += trade.cost * 0.9;
      }

      dataPoints.push({
        time: timeLabel + " (settled)",
        balance: parseFloat(runningBalance.toFixed(2)),
        pnl: parseFloat(runningPnl.toFixed(2)),
      });
    }
  }

  const minBalance = Math.min(...dataPoints.map((d) => d.balance));
  const maxBalance = Math.max(...dataPoints.map((d) => d.balance));
  const currentPnl = runningPnl;
  const pnlColor = currentPnl >= 0 ? "#10b981" : "#ef4444";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            Portfolio Value
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            ${runningBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Total P&L</p>
          <p
            className="text-lg font-bold"
            style={{ color: pnlColor }}
          >
            {currentPnl >= 0 ? "+" : ""}${currentPnl.toFixed(2)}
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={dataPoints}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={pnlColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            domain={[
              Math.floor(minBalance * 0.99),
              Math.ceil(maxBalance * 1.01),
            ]}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              name === "balance" ? "Balance" : "P&L",
            ]}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={pnlColor}
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

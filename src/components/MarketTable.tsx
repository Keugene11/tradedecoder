"use client";

import type { MarketData } from "@/types";

export default function MarketTable({ markets }: { markets: MarketData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 text-left">
            <th className="py-3 px-4 font-medium">Market</th>
            <th className="py-3 px-4 font-medium text-right">YES Price</th>
            <th className="py-3 px-4 font-medium text-right">NO Price</th>
            <th className="py-3 px-4 font-medium text-right">Spread</th>
            <th className="py-3 px-4 font-medium text-right">24h Vol</th>
            <th className="py-3 px-4 font-medium text-right">Prob</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => (
            <tr
              key={m.ticker}
              className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="font-medium text-white truncate max-w-xs">
                  {m.title}
                </div>
                <div className="text-zinc-500 text-xs font-mono">
                  {m.ticker}
                </div>
              </td>
              <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                ${m.yes_bid_dollars.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right text-red-400 font-mono">
                ${m.no_bid_dollars.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right text-zinc-400 font-mono">
                ${(m.spread ?? 0).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right text-zinc-300 font-mono">
                {m.volume_24h_fp.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right text-cyan-400 font-mono">
                {((m.implied_probability ?? 0) * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { KalshiMarket } from "./kalshi";
import { buildMarketContext } from "./market-data";

const DEDALUS_API_URL = "https://api.dedaluslabs.ai";

interface DedalusMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DedalusResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function chatCompletion(messages: DedalusMessage[]): Promise<string> {
  const res = await fetch(`${DEDALUS_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEDALUS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 16384,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Dedalus API error: ${res.status} - ${errorText}`);
  }

  const data: DedalusResponse = await res.json();
  return data.choices[0]?.message?.content || "";
}

export interface MathBreakdown {
  implied_prob_pct: number;
  estimated_true_prob_pct: number;
  edge_pct: number;
  cost_per_contract: number;
  payout_if_win: number;
  profit_if_win: number;
  loss_if_lose: number;
  expected_value_per_dollar: number;
  break_even_prob_pct: number;
  kelly_fraction_pct: number;
}

export interface TradeAnalysis {
  ticker: string;
  title: string;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD";
  confidence: number;
  category: string;
  event_description: string;
  the_bet: string;
  how_you_profit: string;
  summary: string;
  math_breakdown: MathBreakdown;
  pros: string[];
  cons: string[];
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  target_position: "YES" | "NO";
  entry_price: number;
  potential_return_pct: number;
}

export async function analyzeMarkets(
  markets: KalshiMarket[]
): Promise<TradeAnalysis[]> {
  const now = new Date().toISOString();
  const marketSummaries = markets.slice(0, 15).map((m) => {
    const hoursToClose = m.close_time
      ? (new Date(m.close_time).getTime() - Date.now()) / (1000 * 60 * 60)
      : null;
    return {
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      event_ticker: m.event_ticker,
      yes_bid: m.yes_bid_dollars,
      yes_ask: m.yes_ask_dollars,
      no_bid: m.no_bid_dollars,
      no_ask: m.no_ask_dollars,
      last_price: m.last_price_dollars,
      volume_24h: m.volume_24h_fp,
      open_interest: m.open_interest_fp,
      close_time: m.close_time,
      hours_until_close: hoursToClose ? Math.round(hoursToClose * 10) / 10 : null,
      implied_probability: m.implied_probability,
      expected_value: m.expected_value,
      spread: m.spread,
      rules: m.rules_primary?.substring(0, 200),
    };
  });

  const tickers = marketSummaries.map((m) => m.ticker);
  const eventTickers = marketSummaries.map((m) => m.event_ticker);
  const realTimeContext = await buildMarketContext(tickers, eventTickers);

  const systemPrompt = `You are a sharp prediction market trader. You find edges by combining real-time data, structural reasoning, and market dynamics. Your goal is to find 2-5 good bets per batch.

HOW TO FIND EDGES:
1. DATA MISMATCH (strongest): Real-time crypto prices or weather forecasts that contradict the market price. E.g., BTC at $66,300 but market prices "above $68k" at 50% — bet NO.
2. STRUCTURAL MISPRICING: Favorites priced too low on illiquid markets, underdogs with genuine upset potential priced too cheaply, or NO positions where the crowd is overconfident.
3. SPORT/EVENT KNOWLEDGE: Use your knowledge of teams, players, matchups, form, home/away advantages. NBA, NHL, NCAA, soccer, tennis — you know these sports well.
4. TIME-BASED EDGES: Markets closing soon have less time for reversals. A team up big at halftime is more likely to win than the pre-game odds suggest.

RULES:
1. CONSIDER BOTH SIDES: For every market, evaluate YES and NO. The cheaper side often has more edge. NO bets on overpriced favorites are a key profit source.
2. NO FABRICATED STATS: Never invent specific player stats or game scores. Use structural reasoning ("home team advantage", "team on a winning streak", "clear favorite").
3. ENTRY PRICE: Must match yes_ask (for YES bets) or no_ask (for NO bets) from the market data.
4. MAX PRICE: Never recommend a bet priced above $0.70 — the risk/reward is poor.
5. AIM FOR 2-5 picks per batch. Quality over quantity, but don't be afraid to act when you see value.

Current time: ${now}
You MUST respond with valid JSON only. No markdown, no code blocks.`;

  const userPrompt = `Analyze these markets and find the best bets. Look for value on BOTH sides (YES and NO). Aim for 2-5 picks.

${realTimeContext ? `REAL-TIME DATA (use these to calculate actual probabilities):\n${realTimeContext}\n` : ""}Markets:
${JSON.stringify(marketSummaries, null, 2)}

For each market, consider:
- Is the price fair? If not, which side (YES or NO) has the edge?
- For crypto/weather: compare real-time data to the strike price
- For sports: use team quality, matchups, home/away, momentum, and structural factors
- NO bets are often profitable — crowds overestimate favorites

Return a JSON array of picks:
{
  "ticker": "from market data",
  "title": "clean title",
  "recommendation": "STRONG_BUY" | "BUY",
  "confidence": 55-85 (be calibrated — 70+ means very confident),
  "category": "category string",
  "event_description": "2-3 sentences of context",
  "the_bet": "Plain English: 'Betting NO — that [X] won't happen because [reason]'",
  "how_you_profit": "Exact math with real numbers from market data",
  "summary": "100-200 words explaining your edge. For crypto/weather: start with real data. For sports: structural reasoning.",
  "math_breakdown": {
    "implied_prob_pct": "entry_price * 100",
    "estimated_true_prob_pct": "your honest estimate",
    "edge_pct": "estimated minus implied",
    "cost_per_contract": "entry_price",
    "payout_if_win": 1.00,
    "profit_if_win": "1.00 - entry_price",
    "loss_if_lose": "entry_price",
    "expected_value_per_dollar": "(est_prob * 1.00 - cost) / cost",
    "break_even_prob_pct": "entry_price * 100",
    "kelly_fraction_pct": "2-10% range"
  },
  "pros": ["2-4 concrete reasons"],
  "cons": ["2-3 real risks"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": "yes_ask for YES bets, no_ask for NO bets",
  "potential_return_pct": "(1.00 - entry_price) / entry_price * 100"
}

Return a JSON array. Include [] only if genuinely none of the markets have value.`;

  const response = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    console.log(`[analyzeMarkets] AI returned ${Array.isArray(parsed) ? parsed.length : 'non-array'} recommendations from ${markets.length} markets`);
    return parsed;
  } catch {
    console.error("Failed to parse AI response (first 500 chars):", response.substring(0, 500));
    return [];
  }
}

export async function analyzeSpecificMarket(
  market: KalshiMarket
): Promise<TradeAnalysis | null> {
  const now = new Date().toISOString();
  const hoursToClose = market.close_time
    ? (new Date(market.close_time).getTime() - Date.now()) / (1000 * 60 * 60)
    : null;

  const realTimeContext = await buildMarketContext(
    [market.ticker],
    [market.event_ticker]
  );

  const systemPrompt = `You are a disciplined prediction market analyst. Only recommend bets with a genuine, data-backed edge.

RULES:
- For CRYPTO/WEATHER: You have REAL-TIME DATA. Compare it against the strike price to calculate actual probability.
- For SPORTS/OTHER: Do NOT fabricate statistics. Only recommend if you have strong structural reasoning.
- ALWAYS consider both YES and NO sides. Often NO is the better bet.
- If the market seems fairly priced, recommend HOLD. Most markets ARE fairly priced.
- Match analysis to timeframe (${hoursToClose ? Math.round(hoursToClose) + 'h' : 'unknown'} until close).
- No filler sentences. Every claim needs backing.

Current time: ${now}
You MUST respond with valid JSON only.`;

  const userPrompt = `Analyze this market. Consider BOTH sides (YES and NO). Recommend STRONG_BUY, BUY, or HOLD.

${realTimeContext ? `REAL-TIME DATA:\n${realTimeContext}\n` : ""}Ticker: ${market.ticker}
Title: ${market.title}
YES bid/ask: $${market.yes_bid_dollars} / $${market.yes_ask_dollars}
NO bid/ask: $${market.no_bid_dollars} / $${market.no_ask_dollars}
Last price: $${market.last_price_dollars}
24h Volume: ${market.volume_24h_fp}
Open Interest: ${market.open_interest_fp}
Closes: ${market.close_time} (${hoursToClose ? Math.round(hoursToClose) + 'h from now' : 'unknown'})
Rules: ${market.rules_primary}

Return a single JSON object:
{
  "ticker": "${market.ticker}",
  "title": "${market.title}",
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD",
  "confidence": number (0-100, honest),
  "summary": "6-10 sentences. For crypto/weather: start with real data. Consider both sides. Explain why one side has the edge.",
  "pros": ["2-4 data-backed reasons"],
  "cons": ["2-3 real risks"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": number,
  "potential_return_pct": number
}`;

  const response = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse AI response:", response);
    return null;
  }
}

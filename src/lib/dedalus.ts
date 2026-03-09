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

  const systemPrompt = `You are a disciplined prediction market trader. You make money by being SELECTIVE — only betting when you have a genuine, data-backed edge. Most markets are efficiently priced; your job is to find the few that aren't.

WHERE EDGES ACTUALLY COME FROM (ranked by reliability):
1. DATA MISMATCH: You have real-time data (crypto prices, weather forecasts) that contradicts what the market implies. E.g., forecast says 70°F but market prices "above 72°F" at 50% — that's a clear NO bet.
2. STRUCTURAL MISPRICING: The market is pricing something wrong due to a structural factor. E.g., a heavy favorite in a sport priced at only 55% because the market is illiquid. Or a NO position where the crowd is irrationally optimistic.
3. INFORMATION ASYMMETRY: You know something the market hasn't priced in yet.

WHERE EDGES DO NOT COME FROM:
- "This team is generally good" — the market already knows that
- "I feel like 53% is too low" without specific reasoning — that's gut feeling, not edge
- Esports/obscure markets where you have zero knowledge — skip these entirely
- Any sport/match where you can't articulate WHY the market is wrong

CRITICAL RULES:
1. CONSIDER BOTH SIDES: For every market, evaluate BOTH yes and no. If YES is priced at $0.55, then NO costs $0.45. Which side has the edge? Often the NO side is the better bet — the crowd tends to be overconfident on favorites.
2. SKIP MOST MARKETS: If you can't articulate a specific, concrete reason why the market is mispriced, SKIP IT. Returning 1-2 high-conviction picks is better than 5 coin flips. It is perfectly fine to return an empty array [].
3. DATA-BACKED ONLY: For crypto/weather, you MUST compare real-time data against the strike price and calculate the actual probability. For sports without real data, ONLY bet if you have strong general knowledge about the matchup.
4. NO FABRICATED STATS: Never invent specific numbers. Use structural reasoning.
5. ENTRY PRICE: Must match yes_ask (for YES) or no_ask (for NO) from market data.
6. MAX PRICE: Never recommend a bet priced above $0.70.

Current time: ${now}
You MUST respond with valid JSON only. No markdown, no code blocks.`;

  const userPrompt = `Find genuinely mispriced bets in these markets. Be EXTREMELY selective — skip anything where you don't have a real edge.

${realTimeContext ? `REAL-TIME DATA (actual current values — use these to calculate probabilities):\n${realTimeContext}\n` : ""}Markets:
${JSON.stringify(marketSummaries, null, 2)}

IMPORTANT — for each market, ask yourself:
1. Do I have real data that contradicts the market price? (crypto price vs strike, weather forecast vs threshold)
2. Can I articulate a SPECIFIC reason the market is wrong, beyond "I think so"?
3. Have I considered the NO side? Maybe NO is the better bet.
If the answer to all three is no, SKIP the market.

For bets worth placing, return this JSON:
{
  "ticker": "from market data",
  "title": "clean title",
  "recommendation": "STRONG_BUY" | "BUY",
  "confidence": 60-85 (STRONG_BUY requires 70+, be honest),
  "category": "category string",
  "event_description": "2-3 sentences of context",
  "the_bet": "Plain English: 'Betting NO — that BTC will NOT exceed $67,999 in the next 20 hours, since it's currently at $66,300 and would need a 2.5% jump.'",
  "how_you_profit": "Exact math with real numbers from market data",
  "summary": "150-250 words. For crypto/weather: START with the real data and calculate the probability. For sports: structural reasoning only. Explain specifically WHY the market is wrong.",
  "math_breakdown": {
    "implied_prob_pct": "entry_price * 100",
    "estimated_true_prob_pct": "honest estimate backed by data or reasoning",
    "edge_pct": "estimated minus implied",
    "cost_per_contract": "entry_price",
    "payout_if_win": 1.00,
    "profit_if_win": "1.00 - entry_price",
    "loss_if_lose": "entry_price",
    "expected_value_per_dollar": "(est_prob * 1.00 - cost) / cost",
    "break_even_prob_pct": "entry_price * 100",
    "kelly_fraction_pct": "1-10% range, be conservative"
  },
  "pros": ["2-4 concrete reasons backed by data or structural logic"],
  "cons": ["2-3 real risks that could make this bet lose"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO" (seriously consider NO positions!),
  "entry_price": "yes_ask for YES bets, no_ask for NO bets",
  "potential_return_pct": "(1.00 - entry_price) / entry_price * 100"
}

Return a JSON array. Empty array [] is acceptable if nothing looks good.`;

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

import type { KalshiMarket } from "./kalshi";

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
      model: "claude-sonnet-4-20250514",
      messages,
      max_tokens: 2000,
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

export interface TradeAnalysis {
  ticker: string;
  title: string;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "AVOID";
  confidence: number;
  summary: string;
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
  const marketSummaries = markets.slice(0, 15).map((m) => ({
    ticker: m.ticker,
    title: m.title,
    yes_bid: m.yes_bid_dollars,
    yes_ask: m.yes_ask_dollars,
    no_bid: m.no_bid_dollars,
    no_ask: m.no_ask_dollars,
    last_price: m.last_price_dollars,
    volume_24h: m.volume_24h_fp,
    open_interest: m.open_interest_fp,
    close_time: m.close_time,
    implied_probability: m.implied_probability,
    expected_value: m.expected_value,
    spread: m.spread,
    rules: m.rules_primary?.substring(0, 200),
  }));

  const systemPrompt = `You are an expert prediction market analyst specializing in Kalshi event contracts.
Your job is to analyze markets and identify the most profitable trading opportunities.

For each market, consider:
1. Whether the implied probability (from price) is mispriced relative to the true probability
2. Liquidity and volume (higher is better for entry/exit)
3. Time to expiration and information asymmetry
4. Current events and news that might affect the outcome
5. Spread costs and their impact on profitability

You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.`;

  const userPrompt = `Analyze these Kalshi prediction markets and identify the top trading opportunities. For each recommended trade, explain WHY it's profitable and what risks could cause losses.

Markets data:
${JSON.stringify(marketSummaries, null, 2)}

Respond with a JSON array of analyses. Each object must have exactly these fields:
{
  "ticker": "string - market ticker",
  "title": "string - market title",
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "AVOID",
  "confidence": number (0-100),
  "summary": "string - 2-3 sentence analysis of why this trade is recommended",
  "pros": ["string array - reasons this trade will be profitable"],
  "cons": ["string array - risks and reasons this could lose money"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": number (dollar price to enter),
  "potential_return_pct": number (expected return percentage)
}

Return the top 8-10 most interesting opportunities, sorted by recommendation strength.`;

  const response = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  try {
    // Try to parse the response, handling potential markdown wrapping
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
  const systemPrompt = `You are an expert prediction market analyst. Provide a detailed analysis of this specific Kalshi market. You MUST respond with valid JSON only.`;

  const userPrompt = `Give a detailed analysis of this Kalshi market:

Ticker: ${market.ticker}
Title: ${market.title}
YES bid/ask: $${market.yes_bid_dollars} / $${market.yes_ask_dollars}
NO bid/ask: $${market.no_bid_dollars} / $${market.no_ask_dollars}
Last price: $${market.last_price_dollars}
24h Volume: ${market.volume_24h_fp}
Open Interest: ${market.open_interest_fp}
Closes: ${market.close_time}
Rules: ${market.rules_primary}

Respond with a single JSON object (not an array) with these fields:
{
  "ticker": "${market.ticker}",
  "title": "${market.title}",
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "AVOID",
  "confidence": number (0-100),
  "summary": "detailed 3-5 sentence analysis",
  "pros": ["at least 3 reasons this trade could be profitable"],
  "cons": ["at least 3 risks that could cause losses"],
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

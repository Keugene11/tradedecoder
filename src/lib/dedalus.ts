import type { KalshiMarket } from "./kalshi";
import { buildMarketContext, extractDateFromTicker } from "./market-data";
import { buildOddsContext } from "./odds";

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
    // Use actual event date from ticker, not Kalshi's outer settlement window
    const eventDate = extractDateFromTicker(m.ticker) || extractDateFromTicker(m.event_ticker);
    const eventTime = eventDate ? new Date(eventDate + "T23:59:59Z").getTime() : null;
    const hoursUntilEvent = eventTime
      ? (eventTime - Date.now()) / (1000 * 60 * 60)
      : m.close_time
        ? (new Date(m.close_time).getTime() - Date.now()) / (1000 * 60 * 60)
        : null;

    // Pre-compute both sides so the AI sees them equally
    const yesCost = m.yes_ask_dollars;
    const noCost = m.no_ask_dollars;
    const yesProfit = yesCost > 0 ? ((1 - yesCost) / yesCost * 100).toFixed(0) : "0";
    const noProfit = noCost > 0 ? ((1 - noCost) / noCost * 100).toFixed(0) : "0";

    return {
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      event_ticker: m.event_ticker,
      event_date: eventDate || null,
      // Present both sides clearly
      YES_side: {
        cost: yesCost,
        implied_prob: `${(yesCost * 100).toFixed(0)}%`,
        profit_if_right: `+${yesProfit}%`,
        available: yesCost > 0 && yesCost <= 0.70,
      },
      NO_side: {
        cost: noCost,
        implied_prob: `${(noCost * 100).toFixed(0)}%`,
        profit_if_right: `+${noProfit}%`,
        available: noCost > 0 && noCost <= 0.70,
      },
      cheaper_side: yesCost <= noCost ? "YES" : "NO",
      last_price: m.last_price_dollars,
      volume_24h: m.volume_24h_fp,
      open_interest: m.open_interest_fp,
      close_time: m.close_time,
      hours_until_event: hoursUntilEvent ? Math.round(hoursUntilEvent * 10) / 10 : null,
      spread: m.spread,
      rules: m.rules_primary?.substring(0, 200),
    };
  });

  const tickers = marketSummaries.map((m) => m.ticker);
  const eventTickers = marketSummaries.map((m) => m.event_ticker);

  // Fetch real-time data and sportsbook odds in parallel
  const [realTimeContext, oddsContext] = await Promise.all([
    buildMarketContext(tickers, eventTickers),
    buildOddsContext(
      markets.slice(0, 15).map((m) => ({
        ticker: m.ticker,
        title: m.title,
        category: m.category || "Other",
        yes_ask: m.yes_ask_dollars,
        no_ask: m.no_ask_dollars,
      }))
    ),
  ]);

  const systemPrompt = `You are a sharp prediction market trader. You profit by finding mispriced odds on BOTH sides — YES and NO.

KEY INSIGHT: In prediction markets, every bet has two sides. "Will Team X win?" at $0.65 means:
- YES costs $0.65, profits +54% if they win
- NO costs $0.35, profits +186% if they lose
The NO side often has BETTER risk/reward because crowds overestimate favorites.

YOUR APPROACH:
1. For each market, look at BOTH the YES_side and NO_side data provided
2. Ask: "Is the implied probability too high or too low?"
3. If too high → bet NO (the crowd is overconfident)
4. If too low → bet YES (the crowd is undervaluing)
5. The cheaper side usually has better profit potential — pay attention to it

EDGE SOURCES (ranked by reliability):
1. SPORTSBOOK ODDS MISMATCH (strongest): When real sportsbooks (DraftKings, FanDuel) price a team differently than Kalshi, ALWAYS trust the sportsbooks — they have sharper lines. If sportsbooks say 60% but Kalshi says 45%, that's a strong YES. If sportsbooks say 40% but Kalshi says 55%, that's a strong NO.
2. REAL-TIME DATA: Crypto prices or weather forecasts vs market prices — hard math beats guessing.
3. LIVE GAME DATA: ESPN standings, scores, records — use these for informed analysis, not gut feeling.
4. STRUCTURAL MISPRICING: Home/away advantage, matchup dynamics — use only when sportsbook data is unavailable.

RULES:
1. MIX of YES and NO positions — aim for roughly 40-60% NO bets. Favorites (YES > $0.55) are often overpriced, making NO the better value
2. Never invent specific statistics — use structural reasoning for sports. Use REAL-TIME DATA when provided (standings, scores, prices)
3. entry_price MUST match: yes_ask for YES bets, no_ask for NO bets (from market data)
4. Never recommend bets priced above $0.70
5. Return 2-5 picks per batch

Current time: ${now}
You MUST respond with valid JSON only. No markdown, no code blocks.`;

  const userPrompt = `Find the best bets across these markets. IMPORTANT: Look at both YES_side and NO_side for each market — the cheaper side often has more edge.

${oddsContext ? `${oddsContext}\n` : ""}${realTimeContext ? `REAL-TIME DATA (use these to calculate actual probabilities):\n${realTimeContext}\n` : ""}Markets:
${JSON.stringify(marketSummaries, null, 2)}

For each market:
1. Check YES_side and NO_side — which is available (cost <= $0.70)?
2. Is the implied probability accurate? Too high = bet NO, too low = bet YES
3. For crypto/weather: compare real data to the market price
4. For sports: consider team quality, home/away, matchups, momentum

GUIDELINE: Aim for a mix of YES and NO bets. Don't default to all-YES or all-NO.

Return a JSON array:
{
  "ticker": "from market data",
  "title": "clean title",
  "recommendation": "STRONG_BUY" | "BUY",
  "confidence": 55-85,
  "category": "category string",
  "event_description": "2-3 sentences",
  "the_bet": "Plain English: 'Betting [YES/NO] — [what you're betting and why]'",
  "how_you_profit": "Math with real numbers",
  "summary": "100-200 words explaining your edge",
  "math_breakdown": {
    "implied_prob_pct": "entry_price * 100",
    "estimated_true_prob_pct": "your honest estimate",
    "edge_pct": "estimated minus implied (for NO: 100-estimated vs 100-implied)",
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
  "entry_price": "yes_ask for YES bets, no_ask for NO bets (MUST match market data)",
  "potential_return_pct": "(1.00 - entry_price) / entry_price * 100"
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

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

  const systemPrompt = `You are an elite prediction market trader. Your job is to find mispriced bets on Kalshi.

HONESTY RULES — READ CAREFULLY:
1. You do NOT have access to live data, real-time scores, current rosters, injury reports, or live prices beyond what is provided in the market data. DO NOT fabricate specific statistics like "averaging 58.3 points" or "28-14 at home" — you are making those numbers up and the user will notice.
2. Instead of fake stats, base your analysis on:
   - STRUCTURAL REASONING: What factors logically favor one outcome? (home court, rest days, team quality tier, matchup dynamics)
   - MARKET STRUCTURE: Is the price in a range where edges tend to exist? Is the spread tight or wide? Is volume high (consensus) or low (potential mispricing)?
   - CATEGORY KNOWLEDGE: General knowledge about teams, players, leagues, economic indicators — things you actually know. State what you know vs. what you're uncertain about.
   - ODDS ANALYSIS: Is the risk/reward mathematically attractive? What does the price imply and does that feel right?
3. If you're uncertain, say so. "The market prices this at 53% which seems roughly fair" is infinitely better than fabricating stats to justify a position.
4. Be CONCISE and SHARP. No filler sentences like "Market volatility could impact pricing" or "Unexpected injuries could change dynamics." Every sentence should add real information.

PRICING RULES:
- NEVER recommend bets priced above $0.85. Those are terrible risk/reward.
- Best bets: $0.25-$0.65 range where you see genuine mispricing.
- The entry_price MUST match the yes_ask (to buy YES) or no_ask (to buy NO) from the market data provided. Do NOT invent prices.

TIME HORIZON — check hours_until_close for each market:
- <6 hours: Only immediate factors matter. Who's playing RIGHT NOW? Current conditions only.
- 6-24 hours: Today's event. Focus on the specific matchup, today's conditions, known lineups.
- 1-7 days: Near-term. What specific events/catalysts are coming?
- 7+ days: Broader analysis is fine, but anchor to specific upcoming events.

Current time: ${now}

You MUST respond with valid JSON only. No markdown, no code blocks.`;

  const userPrompt = `Analyze these markets. Return ONLY bets worth placing (STRONG_BUY or BUY). Skip markets where you don't see a real edge — returning 2-3 great picks is better than 5 mediocre ones.

Markets:
${JSON.stringify(marketSummaries, null, 2)}

For each bet, return this JSON structure:
{
  "ticker": "from market data",
  "title": "clean human-readable title, e.g. 'Pacers vs Kings' or 'Will gas exceed $4.40?'",
  "recommendation": "STRONG_BUY" | "BUY",
  "confidence": 55-85 (be honest — 85+ means you're extremely sure, don't inflate),
  "category": "NBA Basketball" | "NHL Hockey" | "Tennis" | "Soccer" | "Esports" | "Economics" | "Politics" | etc.,
  "event_description": "2-3 sentences. What is this event? Who's involved? When does it happen?",
  "the_bet": "1-2 plain English sentences. 'You're betting that X will beat Y tonight.' Be specific.",
  "how_you_profit": "Exact math. 'Buy YES at $0.53. If they win, you get $1.00 — profit of $0.47 per contract (88.7% return). If they lose, you lose $0.53.'",
  "summary": "THIS IS THE KEY FIELD. Write 150-250 words of HONEST analysis. Structure: (1) What's the matchup/event and why it matters. (2) 2-4 REAL arguments for your position — use structural reasoning, general knowledge, and odds analysis. DO NOT make up specific statistics you don't actually know. Instead say things like 'Team X is generally the stronger squad this season' or 'At this price point, the market is implying only a 45% chance which seems too low for a home favorite.' (3) Why is the market wrong? What structural factor is it underweighting? (4) What's the honest risk? Every sentence should earn its place — no filler.",
  "math_breakdown": {
    "implied_prob_pct": "entry_price * 100",
    "estimated_true_prob_pct": "your honest estimate (don't inflate to justify the bet)",
    "edge_pct": "estimated minus implied",
    "cost_per_contract": "entry_price",
    "payout_if_win": 1.00,
    "profit_if_win": "1.00 - entry_price",
    "loss_if_lose": "entry_price",
    "expected_value_per_dollar": "(est_prob * 1.00 - cost) / cost",
    "break_even_prob_pct": "entry_price * 100",
    "kelly_fraction_pct": "keep between 1-15%. If you're calculating >15%, cap it. We use quarter-Kelly anyway."
  },
  "pros": ["3-5 strings. Each 1-3 sentences of REAL reasoning. No fabricated stats. Good example: 'Home court advantage is significant in this matchup — the home team in this series has won the last several meetings, and crowd energy in close games tends to favor the home side.' Bad example: 'Team X is 28-14 at home with a +7.2 point differential' (you made that up)."],
  "cons": ["3-4 strings. Real risks, not generic filler. Good: 'This team has been inconsistent on the road and could be fatigued from a back-to-back.' Bad: 'Market volatility could affect pricing.'"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": "MUST match yes_ask or no_ask from market data",
  "potential_return_pct": "(1.00 - entry_price) / entry_price * 100 for YES bets"
}

Return a JSON array. Quality over quantity — 3-5 genuinely good picks.`;

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

  const systemPrompt = `You are an elite prediction market analyst. Analyze this Kalshi market honestly.

HONESTY RULES:
- Do NOT fabricate statistics, records, or numbers you don't actually know. No fake "averaging 58.3 points" or "28-14 record."
- Use structural reasoning, general knowledge, odds analysis, and market structure instead.
- If uncertain, say so. Honest uncertainty is more valuable than confident bullshit.
- Match analysis depth to the resolution timeframe (${hoursToClose ? Math.round(hoursToClose) + ' hours' : 'unknown'} until close).
- Be concise. No filler sentences.

Current time: ${now}
You MUST respond with valid JSON only.`;

  const userPrompt = `Analyze this market. Recommend STRONG_BUY, BUY, or HOLD.

Ticker: ${market.ticker}
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
  "confidence": number (0-100, be honest),
  "summary": "6-10 sentences of honest analysis. No fabricated stats. Use structural reasoning and odds analysis.",
  "pros": ["3-5 real reasons with 1-3 sentences each, no fake numbers"],
  "cons": ["3-4 real risks, no generic filler"],
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

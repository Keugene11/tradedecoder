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
      max_tokens: 4096,
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
  const marketSummaries = markets.slice(0, 15).map((m) => ({
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
    implied_probability: m.implied_probability,
    expected_value: m.expected_value,
    spread: m.spread,
    rules: m.rules_primary?.substring(0, 100),
  }));

  const systemPrompt = `You are an elite prediction market analyst and trader specializing in Kalshi event contracts. You have deep expertise in sports betting, political markets, economic indicators, and weather markets.

Your ONLY job is to find the BEST bets to make — trades where the potential profit justifies the risk. Do NOT recommend trades to avoid. Every trade you return should be one worth placing.

CRITICAL RULE: NEVER recommend bets where you pay $0.85+ to win $0.15 or less. Those are terrible risk/reward. The best bets are where the market is MISPRICED — where you can buy at $0.30-$0.70 and the true probability is significantly higher than the price implies. Look for 20%+ potential returns, not 1-5% returns on near-certainties.

For each market, perform deep analysis considering:
1. Whether the implied probability (from price) is mispriced relative to the true probability based on your knowledge
2. Historical patterns and base rates for similar events
3. Liquidity and volume — higher volume means more market consensus and easier entry/exit
4. Time to expiration and how information flow may shift the price before settlement
5. Current events, recent news, trends, and any edge from public information
6. Spread costs and their real impact on profitability
7. Correlation between markets and hedging opportunities
8. Market sentiment vs statistical reality

You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.`;

  const userPrompt = `Analyze these Kalshi prediction markets and find the BEST bets to place right now. Only return trades you would actually recommend placing money on — either STRONG_BUY or BUY. Do NOT include any HOLD or AVOID recommendations.

For each bet, provide a thorough, detailed analysis explaining exactly why this is a money-making opportunity. Be specific — reference relevant stats, historical patterns, current events, and logical reasoning. The summary should be 5-8 sentences minimum. Each pro and con should be 2-3 sentences with specific reasoning, not generic one-liners.

Markets data:
${JSON.stringify(marketSummaries, null, 2)}

Respond with a JSON array of analyses. Each object must have exactly these fields:
{
  "ticker": "string - market ticker",
  "title": "string - a clear, human-readable title for the bet (not the raw ticker). e.g. 'Boston Celtics vs Cleveland Cavaliers' or 'Will CPI exceed 3.5%?'",
  "recommendation": "STRONG_BUY" | "BUY",
  "confidence": number (0-100),
  "category": "string - the sport or category, e.g. 'NBA Basketball', 'NHL Hockey', 'Economics', 'Politics', 'Weather', 'NCAA Basketball', 'UFC / MMA', etc.",
  "event_description": "string - 2-3 sentences explaining WHAT this event is. Who is playing? What game/event is it? When does it happen? Give full context so someone unfamiliar knows exactly what this is about.",
  "the_bet": "string - 1-2 sentences in plain English explaining exactly what you're betting on. e.g. 'You are betting that the Boston Celtics will beat the Cleveland Cavaliers tonight.' or 'You are betting that Seth Jarvis will score at least 1 goal in tonight's Hurricanes vs Flames game.'",
  "how_you_profit": "string - 2-3 sentences explaining exactly how you make money. e.g. 'You buy YES at $0.85. If the Celtics win, you get $1.00 back — a profit of $0.15 per contract (17.6% return). If they lose, you lose your $0.85.'",
  "summary": "string - detailed 5-8 sentence analysis. MUST include specific numbers: win/loss records, historical stats, percentages, season averages, head-to-head records, or relevant data points. Explain WHY the market probability is wrong using math, not vibes.",
  "math_breakdown": {
    "implied_prob_pct": "number - the market's implied probability from the price (entry_price * 100)",
    "estimated_true_prob_pct": "number - YOUR estimate of the actual probability this bet wins, based on stats and analysis",
    "edge_pct": "number - estimated_true_prob_pct minus implied_prob_pct. This is your edge.",
    "cost_per_contract": "number - what you pay (same as entry_price)",
    "payout_if_win": 1.00,
    "profit_if_win": "number - 1.00 minus cost_per_contract",
    "loss_if_lose": "number - cost_per_contract (what you lose)",
    "expected_value_per_dollar": "number - (estimated_true_prob * payout - cost) / cost. Positive = profitable bet.",
    "break_even_prob_pct": "number - the minimum win probability needed to break even (= cost * 100)",
    "kelly_fraction_pct": "number - Kelly Criterion optimal bet size as % of bankroll: (edge / odds). If edge is 10% and odds are 1:1, kelly = 10%."
  },
  "pros": ["array of 4+ strings - each MUST cite a specific stat, record, percentage, or historical data point. e.g. 'Miami is 28-14 at home this season and Detroit is 8-24 on the road — a 20-game gap in relevant records that the 46c price doesn't reflect.'"],
  "cons": ["array of 3+ strings - each MUST cite a specific risk with numbers. e.g. 'Detroit has covered this spread in 3 of their last 5 road games, suggesting they perform better as underdogs than their overall record indicates.'"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": number (dollar price to enter),
  "potential_return_pct": number (expected return percentage)
}

Return exactly 5 of the best bets, sorted by conviction level. Every single one should be a trade worth making. Keep each analysis detailed but concise to fit within token limits.`;

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
  const systemPrompt = `You are an elite prediction market analyst. Provide a deeply detailed analysis of this specific Kalshi market. Focus on whether this is a bet worth making. You MUST respond with valid JSON only.`;

  const userPrompt = `Give a deeply detailed analysis of this Kalshi market. If it's worth betting on, recommend STRONG_BUY or BUY. Only use HOLD if you're truly unsure.

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
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD",
  "confidence": number (0-100),
  "summary": "detailed 6-10 sentence analysis with specific reasoning, historical context, current events, and why the market is mispriced",
  "pros": ["5+ detailed reasons (2-3 sentences each) this trade could be profitable with specific evidence and reasoning"],
  "cons": ["4+ detailed risks (2-3 sentences each) with specific scenarios that could cause losses"],
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

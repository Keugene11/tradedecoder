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

CRITICAL RULE — TIME HORIZON: Every market has a close_time. Your analysis MUST be calibrated to this timeframe.
- If a market resolves in <24 hours: Focus ONLY on immediate factors — today's matchup, current conditions, short-term catalysts, intraday price action, today's schedule/lineup. Long-term trends and historical macro context are IRRELEVANT for same-day resolution.
- If a market resolves in 1-7 days: Focus on near-term catalysts, upcoming events, short-term momentum, scheduled data releases.
- If a market resolves in 1-4 weeks: Consider medium-term trends but stay grounded in what can realistically change in that window.
- If a market resolves in 1+ months: Broader analysis is appropriate, but still anchor to specific upcoming catalysts.
NEVER give a long-term macro thesis for a bet that resolves tomorrow. A bet on "Will ETH exceed $X by tomorrow" should discuss current price, 24h momentum, order book depth, and immediate catalysts — NOT Ethereum 2.0 history or DeFi growth over years.

For each market, perform deep analysis considering:
1. Whether the implied probability (from price) is mispriced relative to the true probability based on your knowledge
2. Historical patterns and base rates for similar events
3. Liquidity and volume — higher volume means more market consensus and easier entry/exit
4. Time to expiration and how information flow may shift the price before settlement — MATCH YOUR ANALYSIS DEPTH TO THIS TIMEFRAME
5. Current events, recent news, trends, and any edge from public information
6. Spread costs and their real impact on profitability
7. Correlation between markets and hedging opportunities
8. Market sentiment vs statistical reality

You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.`;

  const userPrompt = `Analyze these Kalshi prediction markets and find the BEST bets to place right now. Only return trades you would actually recommend placing money on — either STRONG_BUY or BUY. Do NOT include any HOLD or AVOID recommendations.

For each bet, provide an EXTREMELY thorough and detailed analysis. This is the most important part — users read these analyses to understand why a trade is worth making. Each analysis must be at minimum 200 words, ideally 300+. Pack it with specific numbers, statistics, win/loss records, historical data, percentages, season averages, head-to-head matchups, recent form, and concrete reasoning. Do NOT be vague or generic — every claim must be backed by a specific data point or logical argument.

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
  "summary": "string - THIS IS THE MAIN ANALYSIS. Write a minimum of 200 words (ideally 300+). IMPORTANT: Match your analysis to the resolution timeframe (check close_time). For same-day bets, focus on TODAY's factors — current lineups, injuries, recent form, immediate catalysts, current price/conditions. Do NOT write long-term macro essays for short-term bets. Structure it as: (1) Set the scene — what's happening TODAY and why it matters. (2) Present 3-5 specific statistical arguments with real numbers relevant to the TIMEFRAME — for sports: recent form, matchup stats, today's conditions; for crypto/economics: current price, 24h movement, immediate catalysts. (3) Explain exactly why the market price is wrong RIGHT NOW. (4) Conclude with conviction and risk/reward. Be specific and data-driven. NO generic filler.",
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
  "pros": ["array of 5+ strings - each MUST be 2-4 sentences citing specific stats, records, percentages, or historical data. e.g. 'Miami is 28-14 at home this season with a +7.2 point differential, while Detroit is 8-24 on the road with a -9.1 differential. That 16.3-point swing in home/away performance creates a massive edge that the current 46-cent price dramatically undervalues.'"],
  "cons": ["array of 4+ strings - each MUST be 2-4 sentences citing specific risks with numbers. e.g. 'Detroit has covered this spread in 3 of their last 5 road games, and Cade Cunningham is averaging 28.4 PPG over that stretch. They also beat Miami 108-102 in their last meeting on Feb 12, showing they can compete in this matchup.'"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "target_position": "YES" | "NO",
  "entry_price": number (dollar price to enter),
  "potential_return_pct": number (expected return percentage)
}

Return exactly 5 of the best bets, sorted by conviction level. Every single one should be a trade worth making. DO NOT cut corners on analysis length — each trade's summary MUST be 200+ words with specific statistics and numbers. The user is reading these to make decisions, so quality and depth matter more than brevity.`;

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
  const systemPrompt = `You are an elite prediction market analyst. Provide a deeply detailed analysis of this specific Kalshi market. Focus on whether this is a bet worth making. CRITICAL: Match your analysis to the resolution timeframe — if the market closes within 24 hours, focus ONLY on immediate short-term factors (current price, today's conditions, intraday catalysts), NOT long-term macro narratives. You MUST respond with valid JSON only.`;

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

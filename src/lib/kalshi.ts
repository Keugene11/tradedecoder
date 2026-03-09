import { extractDateFromTicker } from "./market-data";

const BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

export interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle: string;
  yes_sub_title: string;
  no_sub_title: string;
  status: string;
  result: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  last_price: number;
  last_price_dollars: string;
  previous_yes_bid_dollars: string;
  previous_yes_ask_dollars: string;
  previous_price_dollars: string;
  volume: number;
  volume_fp: string;
  volume_24h: number;
  volume_24h_fp: string;
  open_interest: number;
  open_interest_fp: string;
  notional_value_dollars: string;
  close_time: string;
  created_time: string;
  rules_primary: string;
  rules_secondary: string;
  category: string;
  series_ticker: string;
}

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle: string;
  status: string;
  result: string;
  yes_bid_dollars: number;
  yes_ask_dollars: number;
  no_bid_dollars: number;
  no_ask_dollars: number;
  last_price_dollars: number;
  volume_24h_fp: number;
  open_interest_fp: number;
  close_time: string;
  rules_primary: string;
  category: string;
  // Previous session prices (line movement detection)
  prev_yes_bid: number;
  prev_yes_ask: number;
  prev_price: number;
  price_change: number; // current - previous (positive = moved up)
  // computed
  implied_probability?: number;
  expected_value?: number;
  spread?: number;
  volume_score?: number;
}

export interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

function parseMarket(raw: KalshiMarketRaw): KalshiMarket {
  // Derive category from event ticker prefix and title
  const et = raw.event_ticker || "";
  const title = (raw.title || "").toLowerCase();
  let category = "Other";
  // Sports
  if (et.includes("NBA")) category = "NBA Basketball";
  else if (et.includes("NHL")) category = "NHL Hockey";
  else if (et.includes("NFL")) category = "NFL Football";
  else if (et.includes("MLB")) category = "MLB Baseball";
  else if (et.includes("MLS")) category = "MLS Soccer";
  else if (et.includes("UFC")) category = "UFC / MMA";
  else if (et.includes("NCAAM") || et.includes("NCAAB")) category = "NCAA Men's Basketball";
  else if (et.includes("NCAAW") || et.includes("NCAAWB")) category = "NCAA Women's Basketball";
  else if (et.includes("NCAAF")) category = "NCAA Football";
  else if (et.includes("NCAAHOCEKY") || et.includes("NCAAHOCKEY")) category = "NCAA Hockey";
  else if (et.includes("NCAAMLAX")) category = "NCAA Lacrosse";
  else if (et.includes("KXATP") || et.includes("KXWTA")) category = "Tennis";
  else if (et.includes("KXFIBA") || et.includes("KXJBLEAGUE") || et.includes("KXARGLNB") || et.includes("KXNBL") || et.includes("KXVTB")) category = "International Basketball";
  else if (et.includes("KXBRASILEIRO") || et.includes("KXDIMAYO") || et.includes("KXARGPREM") || et.includes("KXEGYPL") || et.includes("KXAFCCL") || et.includes("KXUSL") || et.includes("SOC") || et.includes("SOCCER")) category = "Soccer";
  else if (et.includes("KXKHL")) category = "International Hockey";
  else if (et.includes("KXWBC")) category = "World Baseball Classic";
  // Esports
  else if (et.includes("KXLOL") || et.includes("KXVALORANT") || et.includes("KXCS2")) category = "Esports";
  // Weather
  else if (et.includes("KXHIGHT") || et.includes("KXHIGH") || et.includes("KXLOWT") || et.includes("KXWEATHER") || et.includes("KXRAIN") || et.includes("KXSNOW") || title.includes("temperature") || title.includes("high temp") || title.includes("rainfall")) category = "Weather";
  // Crypto
  else if (et.includes("KXBTC") || et.includes("KXETH") || et.includes("KXSOL") || et.includes("KXDOGE") || et.includes("KXXRP") || et.includes("KXSHIBA") || et.includes("KXCRYPTO") || title.includes("bitcoin") || title.includes("ethereum")) category = "Crypto";
  // Pop Culture & Entertainment
  else if (et.includes("KXSPOT") || title.includes("spotify") || title.includes("streams")) category = "Pop Culture";
  // Politics & Government
  else if (et.includes("KXEO") || et.includes("KXPOL") || et.includes("KXGOV") || title.includes("president") || title.includes("executive order") || title.includes("congress") || title.includes("senate") || title.includes("tariff")) category = "Politics";
  // Economics
  else if (et.includes("KXECON") || et.includes("KXAAAG") || et.includes("CPI") || et.includes("GDP") || et.includes("FED") || et.includes("FOMC") || title.includes("gas price")) category = "Economics";
  // MVE combo markets
  else if (et.includes("KXMVE")) category = "Cross-Category";

  const currentPrice = parseFloat(raw.last_price_dollars) || 0;
  const prevPrice = parseFloat(raw.previous_price_dollars) || 0;

  return {
    ticker: raw.ticker,
    event_ticker: raw.event_ticker,
    market_type: raw.market_type,
    title: raw.title,
    subtitle: raw.subtitle,
    status: raw.status,
    result: raw.result,
    yes_bid_dollars: parseFloat(raw.yes_bid_dollars) || 0,
    yes_ask_dollars: parseFloat(raw.yes_ask_dollars) || 0,
    no_bid_dollars: parseFloat(raw.no_bid_dollars) || 0,
    no_ask_dollars: parseFloat(raw.no_ask_dollars) || 0,
    last_price_dollars: currentPrice,
    volume_24h_fp: parseFloat(raw.volume_24h_fp) || 0,
    open_interest_fp: parseFloat(raw.open_interest_fp) || 0,
    close_time: raw.close_time,
    rules_primary: raw.rules_primary,
    category,
    // Line movement data
    prev_yes_bid: parseFloat(raw.previous_yes_bid_dollars) || 0,
    prev_yes_ask: parseFloat(raw.previous_yes_ask_dollars) || 0,
    prev_price: prevPrice,
    price_change: prevPrice > 0 ? currentPrice - prevPrice : 0,
  };
}

export async function fetchMarkets(params?: {
  status?: string;
  limit?: number;
  cursor?: string;
  series_ticker?: string;
  event_ticker?: string;
}): Promise<{ markets: KalshiMarket[]; cursor: string }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.series_ticker) searchParams.set("series_ticker", params.series_ticker);
  if (params?.event_ticker) searchParams.set("event_ticker", params.event_ticker);

  const res = await fetch(`${BASE_URL}/markets?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    markets: data.markets.map(parseMarket),
    cursor: data.cursor,
  };
}

export async function fetchAllOpenMarkets(): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let cursor = "";
  let pages = 0;
  const MAX_PAGES = 3; // 3000 markets is plenty, keeps serverless fast

  do {
    const searchParams = new URLSearchParams({
      status: "open",
      limit: "1000",
      mve_filter: "exclude", // Exclude multivariate combo markets
    });
    if (cursor) searchParams.set("cursor", cursor);

    const res = await fetch(`${BASE_URL}/markets?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Kalshi API error: ${res.status} - ${body}`);
    }

    const data = await res.json();
    const parsed = (data.markets || []).map(parseMarket);
    allMarkets.push(...parsed);
    cursor = data.cursor || "";
    pages++;
  } while (cursor && pages < MAX_PAGES);

  return allMarkets;
}

export async function fetchMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const res = await fetch(`${BASE_URL}/markets/${ticker}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseMarket(data.market);
  } catch {
    return null;
  }
}

export async function fetchEvent(eventTicker: string): Promise<KalshiEvent> {
  const res = await fetch(
    `${BASE_URL}/events/${eventTicker}?with_nested_markets=true`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Kalshi API error: ${res.status}`);
  }
  const data = await res.json();
  return data.event;
}

export async function fetchOrderbook(ticker: string) {
  const res = await fetch(`${BASE_URL}/markets/${ticker}/orderbook`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);
  return res.json();
}

export function enrichMarket(market: KalshiMarket): KalshiMarket {
  const yesPrice = market.yes_bid_dollars || market.last_price_dollars || 0;
  const noPrice = market.no_bid_dollars || (1 - yesPrice);

  // Implied probability from yes price (price ≈ probability in prediction markets)
  const impliedProbability = yesPrice;

  // Spread between bid and ask
  const spread = (market.yes_ask_dollars || 0) - (market.yes_bid_dollars || 0);

  // Volume score (normalized)
  const volumeScore = Math.min(market.volume_24h_fp / 100, 1);

  // Expected value calculation:
  // If you buy YES at yes_ask price, you get $1 if correct
  // EV = (probability * $1) - cost
  const cost = market.yes_ask_dollars || yesPrice;
  const expectedValue = cost > 0 ? (impliedProbability * 1 - cost) / cost : 0;

  return {
    ...market,
    implied_probability: impliedProbability,
    expected_value: expectedValue,
    spread,
    volume_score: volumeScore,
  };
}

export function scoreAndRankMarkets(markets: KalshiMarket[], maxPerCategory = 5): KalshiMarket[] {
  const scored = markets
    .map(enrichMarket)
    .filter((m) => {
      const yesPrice = m.yes_ask_dollars || m.yes_bid_dollars || 0;
      const noPrice = m.no_ask_dollars || m.no_bid_dollars || 0;
      // Best price to buy either side
      const cheaperSide = Math.min(yesPrice, noPrice || 1);

      return (
        m.yes_bid_dollars > 0 &&
        m.yes_ask_dollars > 0 &&
        (m.status === "active" || m.status === "open") &&
        // KILL the 99c-for-1c bets: exclude markets where the cheaper side
        // is below $0.10 (>90% implied probability either way).
        // Sweet spot is $0.15 - $0.85 range on at least one side.
        cheaperSide >= 0.10 &&
        // Also exclude extreme locks where YES is above $0.90
        yesPrice <= 0.90
      );
    })
    .sort((a, b) => {
      const now = Date.now();

      // Prioritize interesting odds in the 20-80% range with good volume
      const priceA = a.yes_ask_dollars || a.yes_bid_dollars || 0;
      const priceB = b.yes_ask_dollars || b.yes_bid_dollars || 0;

      // How close to 50/50 (more uncertain = more potential edge)
      const uncertaintyA = 1 - Math.abs(priceA - 0.50) * 2;
      const uncertaintyB = 1 - Math.abs(priceB - 0.50) * 2;

      // Volume score (normalized, capped at 500)
      const volA = Math.min((a.volume_24h_fp || 0) / 500, 1);
      const volB = Math.min((b.volume_24h_fp || 0) / 500, 1);

      // Spread penalty (lower spread = better)
      const spreadA = 1 - Math.min((a.spread || 0) / 0.10, 1);
      const spreadB = 1 - Math.min((b.spread || 0) / 0.10, 1);

      // Time urgency — use EVENT DATE from ticker (actual game day) rather than
      // close_time (Kalshi's outer settlement window, often 2+ weeks out)
      const getEventHours = (m: KalshiMarket) => {
        const eventDate = extractDateFromTicker(m.ticker) || extractDateFromTicker(m.event_ticker);
        if (eventDate) {
          // Event date is the actual game day — add 24h for end-of-day resolution
          const eventEnd = new Date(eventDate + "T23:59:59Z").getTime();
          return (eventEnd - now) / (1000 * 60 * 60);
        }
        // Fallback to close_time
        return m.close_time ? (new Date(m.close_time).getTime() - now) / (1000 * 60 * 60) : 999;
      };

      const hoursToEventA = getEventHours(a);
      const hoursToEventB = getEventHours(b);

      // Score: 1.0 for today (within 24h), 0.7 for tomorrow, 0.4 for 2 days, 0.2 for this week, 0.0 for 7d+
      const urgencyA = hoursToEventA <= 12 ? 1.0 : hoursToEventA <= 24 ? 0.9 : hoursToEventA <= 48 ? 0.7 : hoursToEventA <= 72 ? 0.4 : hoursToEventA <= 168 ? 0.2 : 0;
      const urgencyB = hoursToEventB <= 12 ? 1.0 : hoursToEventB <= 24 ? 0.9 : hoursToEventB <= 48 ? 0.7 : hoursToEventB <= 72 ? 0.4 : hoursToEventB <= 168 ? 0.2 : 0;

      // Composite: time urgency is the biggest factor
      const scoreA = urgencyA * 0.30 + uncertaintyA * 0.25 + volA * 0.25 + spreadA * 0.20;
      const scoreB = urgencyB * 0.30 + uncertaintyB * 0.25 + volB * 0.25 + spreadB * 0.20;
      return scoreB - scoreA;
    });

  // Diversify: cap each category so no single type dominates
  const categoryCounts: Record<string, number> = {};
  const diversified: KalshiMarket[] = [];
  const overflow: KalshiMarket[] = [];

  for (const m of scored) {
    const cat = m.category || "Other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    if (categoryCounts[cat] <= maxPerCategory) {
      diversified.push(m);
    } else {
      overflow.push(m);
    }
  }

  // Append overflow at the end so they're still available if needed
  return [...diversified, ...overflow];
}

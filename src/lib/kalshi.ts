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
    last_price_dollars: parseFloat(raw.last_price_dollars) || 0,
    volume_24h_fp: parseFloat(raw.volume_24h_fp) || 0,
    open_interest_fp: parseFloat(raw.open_interest_fp) || 0,
    close_time: raw.close_time,
    rules_primary: raw.rules_primary,
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
    next: { revalidate: 60 },
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
  const MAX_PAGES = 10;

  do {
    const searchParams = new URLSearchParams({
      status: "open",
      limit: "1000",
      mve_filter: "exclude", // Exclude multivariate combo markets
    });
    if (cursor) searchParams.set("cursor", cursor);

    const res = await fetch(`${BASE_URL}/markets?${searchParams.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);

    const data = await res.json();
    const parsed = (data.markets || []).map(parseMarket);
    allMarkets.push(...parsed);
    cursor = data.cursor || "";
    pages++;
  } while (cursor && pages < MAX_PAGES);

  return allMarkets;
}

export async function fetchEvent(eventTicker: string): Promise<KalshiEvent> {
  const res = await fetch(
    `${BASE_URL}/events/${eventTicker}?with_nested_markets=true`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) {
    throw new Error(`Kalshi API error: ${res.status}`);
  }
  const data = await res.json();
  return data.event;
}

export async function fetchOrderbook(ticker: string) {
  const res = await fetch(`${BASE_URL}/markets/${ticker}/orderbook`, {
    next: { revalidate: 30 },
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

export function scoreAndRankMarkets(markets: KalshiMarket[]): KalshiMarket[] {
  return markets
    .map(enrichMarket)
    .filter((m) => {
      // Filter out markets with no meaningful data
      return (
        m.yes_bid_dollars > 0 &&
        m.yes_ask_dollars > 0 &&
        m.volume_24h_fp > 0 &&
        (m.status === "active" || m.status === "open")
      );
    })
    .sort((a, b) => {
      // Composite score: high EV + high volume + low spread
      const scoreA =
        (a.expected_value || 0) * 0.4 +
        (a.volume_score || 0) * 0.3 +
        (1 - (a.spread || 0)) * 0.3;
      const scoreB =
        (b.expected_value || 0) * 0.4 +
        (b.volume_score || 0) * 0.3 +
        (1 - (b.spread || 0)) * 0.3;
      return scoreB - scoreA;
    });
}

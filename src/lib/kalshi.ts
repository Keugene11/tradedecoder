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
  // Derive category from event ticker prefix
  const et = raw.event_ticker || "";
  let category = "Other";
  if (et.includes("NBA")) category = "NBA Basketball";
  else if (et.includes("NHL")) category = "NHL Hockey";
  else if (et.includes("NFL")) category = "NFL Football";
  else if (et.includes("MLB")) category = "MLB Baseball";
  else if (et.includes("MLS")) category = "MLS Soccer";
  else if (et.includes("UFC")) category = "UFC / MMA";
  else if (et.includes("NCAAM") || et.includes("NCAAB")) category = "NCAA Men's Basketball";
  else if (et.includes("NCAAW") || et.includes("NCAAWB")) category = "NCAA Women's Basketball";
  else if (et.includes("NCAAF")) category = "NCAA Football";
  else if (et.includes("SOC") || et.includes("SOCCER")) category = "Soccer";
  else if (et.includes("KXWBC")) category = "World Baseball Classic";
  else if (et.includes("KXECON") || et.includes("CPI") || et.includes("GDP") || et.includes("FED") || et.includes("FOMC")) category = "Economics";
  else if (et.includes("KXPOL") || et.includes("TRUMP") || et.includes("BIDEN") || et.includes("CONGRESS")) category = "Politics";
  else if (et.includes("KXWEATHER") || et.includes("TEMP") || et.includes("RAIN")) category = "Weather";
  else if (et.includes("KXCRYPTO") || et.includes("BTC") || et.includes("ETH")) category = "Crypto";

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
    category,
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

export function scoreAndRankMarkets(markets: KalshiMarket[]): KalshiMarket[] {
  return markets
    .map(enrichMarket)
    .filter((m) => {
      const yesPrice = m.yes_ask_dollars || m.yes_bid_dollars || 0;
      const noPrice = m.no_ask_dollars || m.no_bid_dollars || 0;
      // Best price to buy either side
      const cheaperSide = Math.min(yesPrice, noPrice || 1);

      return (
        m.yes_bid_dollars > 0 &&
        m.yes_ask_dollars > 0 &&
        m.volume_24h_fp > 0 &&
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
      // Prioritize interesting odds in the 20-80% range with good volume
      const priceA = a.yes_ask_dollars || a.yes_bid_dollars || 0;
      const priceB = b.yes_ask_dollars || b.yes_bid_dollars || 0;

      // How close to 50/50 (more uncertain = more potential edge)
      const uncertaintyA = 1 - Math.abs(priceA - 0.50) * 2; // 1.0 at 50c, 0.0 at 0c/100c
      const uncertaintyB = 1 - Math.abs(priceB - 0.50) * 2;

      // Volume score (normalized, capped at 500)
      const volA = Math.min((a.volume_24h_fp || 0) / 500, 1);
      const volB = Math.min((b.volume_24h_fp || 0) / 500, 1);

      // Spread penalty (lower spread = better)
      const spreadA = 1 - Math.min((a.spread || 0) / 0.10, 1);
      const spreadB = 1 - Math.min((b.spread || 0) / 0.10, 1);

      // Composite: uncertainty matters most (find mispriced bets),
      // then volume (can actually trade it), then tight spread
      const scoreA = uncertaintyA * 0.40 + volA * 0.35 + spreadA * 0.25;
      const scoreB = uncertaintyB * 0.40 + volB * 0.35 + spreadB * 0.25;
      return scoreB - scoreA;
    });
}

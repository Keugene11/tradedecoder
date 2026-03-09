/**
 * Real-time data enrichment for market analysis.
 * Fetches current prices, forecasts, and odds to give the AI
 * actual data instead of letting it guess.
 */

interface CryptoPrice {
  coin: string;
  current_price: number;
  price_change_24h: number;
  price_change_pct_24h: number;
  high_24h: number;
  low_24h: number;
  market_cap: number;
  volume_24h: number;
}

interface WeatherForecast {
  city: string;
  date: string;
  high_f: number;
  low_f: number;
  precipitation_probability: number;
  precipitation_mm: number;
  conditions: string;
}

// Map Kalshi city codes to coordinates for Open-Meteo
const CITY_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  NYC: { lat: 40.7128, lon: -74.006, name: "New York" },
  CHI: { lat: 41.8781, lon: -87.6298, name: "Chicago" },
  LAX: { lat: 34.0522, lon: -118.2437, name: "Los Angeles" },
  MIA: { lat: 25.7617, lon: -80.1918, name: "Miami" },
  DFW: { lat: 32.7767, lon: -96.797, name: "Dallas" },
  DEN: { lat: 39.7392, lon: -104.9903, name: "Denver" },
  PHX: { lat: 33.4484, lon: -112.074, name: "Phoenix" },
  SEA: { lat: 47.6062, lon: -122.3321, name: "Seattle" },
  ATL: { lat: 33.749, lon: -84.388, name: "Atlanta" },
  BOS: { lat: 42.3601, lon: -71.0589, name: "Boston" },
  SFO: { lat: 37.7749, lon: -122.4194, name: "San Francisco" },
  LV: { lat: 36.1699, lon: -115.1398, name: "Las Vegas" },
  HOU: { lat: 29.7604, lon: -95.3698, name: "Houston" },
  PHL: { lat: 39.9526, lon: -75.1652, name: "Philadelphia" },
  DC: { lat: 38.9072, lon: -77.0369, name: "Washington DC" },
  MSP: { lat: 44.9778, lon: -93.265, name: "Minneapolis" },
  DTW: { lat: 42.3314, lon: -83.0458, name: "Detroit" },
  TPA: { lat: 27.9506, lon: -82.4572, name: "Tampa" },
  SAN: { lat: 32.7157, lon: -117.1611, name: "San Diego" },
  PDX: { lat: 45.5152, lon: -122.6784, name: "Portland" },
  AUS: { lat: 30.2672, lon: -97.7431, name: "Austin" },
  STL: { lat: 38.627, lon: -90.1994, name: "St. Louis" },
  PIT: { lat: 40.4406, lon: -79.9959, name: "Pittsburgh" },
  CLE: { lat: 41.4993, lon: -81.6944, name: "Cleveland" },
  ORL: { lat: 28.5383, lon: -81.3792, name: "Orlando" },
  BNA: { lat: 36.1627, lon: -86.7816, name: "Nashville" },
  IND: { lat: 39.7684, lon: -86.1581, name: "Indianapolis" },
  MKE: { lat: 43.0389, lon: -87.9065, name: "Milwaukee" },
  SLC: { lat: 40.7608, lon: -111.891, name: "Salt Lake City" },
  JAX: { lat: 30.3322, lon: -81.6557, name: "Jacksonville" },
};

// CoinGecko coin IDs
const COIN_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  XRP: "ripple",
  SHIBA: "shiba-inu",
};

export async function fetchCryptoPrices(coins: string[]): Promise<CryptoPrice[]> {
  const ids = coins
    .map((c) => COIN_MAP[c.toUpperCase()])
    .filter(Boolean);

  if (ids.length === 0) return [];

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h`,
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return data.map((coin: Record<string, unknown>) => ({
      coin: coin.symbol as string,
      current_price: coin.current_price as number,
      price_change_24h: coin.price_change_24h as number,
      price_change_pct_24h: coin.price_change_percentage_24h as number,
      high_24h: coin.high_24h as number,
      low_24h: coin.low_24h as number,
      market_cap: coin.market_cap as number,
      volume_24h: coin.total_volume as number,
    }));
  } catch {
    return [];
  }
}

export async function fetchWeatherForecast(
  cityCode: string,
  date: string
): Promise<WeatherForecast | null> {
  const city = CITY_COORDS[cityCode.toUpperCase()];
  if (!city) return null;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=America/New_York&start_date=${date}&end_date=${date}`,
      { cache: "no-store" }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const daily = data.daily;
    if (!daily || !daily.time || daily.time.length === 0) return null;

    const weatherCode = daily.weather_code?.[0] || 0;
    const conditions = weatherCodeToString(weatherCode);

    return {
      city: city.name,
      date,
      high_f: daily.temperature_2m_max[0],
      low_f: daily.temperature_2m_min[0],
      precipitation_probability: daily.precipitation_probability_max?.[0] || 0,
      precipitation_mm: daily.precipitation_sum?.[0] || 0,
      conditions,
    };
  } catch {
    return null;
  }
}

function weatherCodeToString(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

/**
 * Extract city code from a weather market ticker.
 * e.g. KXHIGHTLV-26MAR09-B77.5 -> "LV"
 *      KXLOWTMIA-26MAR09-T72 -> "MIA"
 */
export function extractCityFromTicker(ticker: string): string | null {
  // Try event_ticker patterns: KXHIGHT{CITY} or KXLOWT{CITY} or KXHIGH{CITY}
  const match = ticker.match(/KX(?:HIGHT|LOWT|HIGH|LOW|RAIN|SNOW)([A-Z]{2,4})/);
  return match ? match[1] : null;
}

/**
 * Extract date from a market ticker.
 * e.g. KXHIGHTLV-26MAR09-B77.5 -> "2026-03-09"
 */
export function extractDateFromTicker(ticker: string): string | null {
  const match = ticker.match(/(\d{2})([A-Z]{3})(\d{2})/);
  if (!match) return null;

  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  const year = `20${match[1]}`;
  const month = months[match[2]];
  const day = match[3];
  if (!month) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Extract crypto coin from a market ticker/event_ticker.
 * e.g. KXBTCD-26MAR0917-T64999.99 -> "BTC"
 *      KXETHD-26MAR0917-T1949.99 -> "ETH"
 */
export function extractCoinFromTicker(ticker: string): string | null {
  const match = ticker.match(/KX(BTC|ETH|SOL|DOGE|XRP|SHIBA)/);
  return match ? match[1] : null;
}

export interface MarketContext {
  crypto?: CryptoPrice[];
  weather?: WeatherForecast;
}

/**
 * Build a context string with real data for a set of markets.
 * This gets injected into the AI prompt so it has actual facts.
 */
export async function buildMarketContext(
  tickers: string[],
  eventTickers: string[]
): Promise<string> {
  const lines: string[] = [];

  // Collect unique crypto coins needed
  const coins = new Set<string>();
  for (const t of [...tickers, ...eventTickers]) {
    const coin = extractCoinFromTicker(t);
    if (coin) coins.add(coin);
  }

  // Collect unique weather cities/dates needed
  const weatherRequests = new Map<string, string>(); // city -> date
  for (const t of [...tickers, ...eventTickers]) {
    const city = extractCityFromTicker(t);
    const date = extractDateFromTicker(t);
    if (city && date) {
      weatherRequests.set(city, date);
    }
  }

  // Fetch in parallel
  const [cryptoPrices, ...weatherForecasts] = await Promise.all([
    coins.size > 0 ? fetchCryptoPrices([...coins]) : Promise.resolve([]),
    ...Array.from(weatherRequests.entries()).map(([city, date]) =>
      fetchWeatherForecast(city, date)
    ),
  ]);

  // Build context string
  if (cryptoPrices.length > 0) {
    lines.push("=== LIVE CRYPTO PRICES (from CoinGecko, real-time) ===");
    for (const p of cryptoPrices) {
      lines.push(
        `${p.coin.toUpperCase()}: $${p.current_price.toLocaleString()} | 24h: ${p.price_change_pct_24h >= 0 ? "+" : ""}${p.price_change_pct_24h.toFixed(2)}% | High: $${p.high_24h.toLocaleString()} | Low: $${p.low_24h.toLocaleString()} | Vol: $${(p.volume_24h / 1e9).toFixed(2)}B`
      );
    }
    lines.push("");
  }

  const validForecasts = weatherForecasts.filter(Boolean) as WeatherForecast[];
  if (validForecasts.length > 0) {
    lines.push("=== WEATHER FORECASTS (from Open-Meteo, real data) ===");
    for (const f of validForecasts) {
      lines.push(
        `${f.city} on ${f.date}: High ${f.high_f.toFixed(1)}°F / Low ${f.low_f.toFixed(1)}°F | ${f.conditions} | Precip: ${f.precipitation_probability}% chance, ${f.precipitation_mm.toFixed(1)}mm`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

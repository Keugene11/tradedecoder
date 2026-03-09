# TradeDecoder

AI-powered paper trading on [Kalshi](https://kalshi.com) prediction markets. Analyzes thousands of live markets across sports, crypto, politics, economics, and more — then places bets where the AI finds mispriced odds.

**Live:** [tradedecoder.vercel.app](https://tradedecoder.vercel.app)

## What It Does

- Fetches all open Kalshi markets in real-time (sports, crypto, politics, weather, esports, economics)
- AI analyzes each market for mispriced odds using structural reasoning and market analysis
- Auto-places paper trades using quarter-Kelly position sizing
- Tracks portfolio performance with P&L charts and trade history
- Settles trades based on actual market resolution

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 — clean minimal UI inspired by Robinhood/Cal.ai
- **AI:** Dedalus API (OpenAI-compatible) for trade analysis
- **Storage:** Upstash Redis for paper trade state
- **Deployment:** Vercel

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/markets` | GET | Fetch & rank all open Kalshi markets |
| `/api/analyze` | POST | AI analysis on a batch of markets |
| `/api/analyze/[ticker]` | GET | AI analysis on a specific market |
| `/api/paper-trade` | GET | Get all trades + portfolio stats |
| `/api/paper-trade/auto` | POST | AI auto-trade: analyze markets & place bets |
| `/api/paper-trade/settle` | POST | Settle open trades based on market resolution |
| `/api/paper-trade/reanalyze` | POST | Re-run AI analysis on all open trades |
| `/api/paper-trade/reset` | POST | Delete all trades, reset balance to $10,000 |

## How Auto-Trade Works

1. Fetches all open markets from Kalshi API
2. Ranks by a composite score (time urgency, uncertainty, volume, spread)
3. Diversifies selection round-robin across categories (NBA, NHL, crypto, politics, etc.)
4. AI analyzes batches of 10 markets, returns STRONG_BUY/BUY recommendations
5. Places bets using quarter-Kelly criterion for position sizing
6. Skips markets already in the portfolio

## Edge Detection

The system finds mispricings through quantitative signals, not AI guessing:

1. **Sportsbook odds comparison** (strongest) — Compares Kalshi prices against DraftKings, FanDuel, BetMGM via The Odds API. Removes vig to get fair probabilities. If sportsbooks say 60% but Kalshi says 45%, that's a quantifiable edge.
2. **Real-time data mismatch** — Live crypto prices (CoinGecko) and weather forecasts (Open-Meteo) compared against market strike prices. Hard math, not vibes.
3. **ESPN live data** — NBA/NHL standings, win/loss records, home/away splits, streaks, and live scoreboards injected into analysis.
4. **Both-sides analysis** — Every market is pre-computed showing YES and NO cost/profit/availability. The AI sees both sides equally, preventing YES-only bias.

## Settlement Rules

- Sells at >= 90c (win) or <= 10c (loss)
- Take profit at >= 30% gain
- Stop loss at >= 40% loss
- Expired markets: lose 50% of cost

## Setup

```bash
pnpm install
```

Create `.env.local`:

```
DEDALUS_API_KEY=your_key
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
ODDS_API_KEY=your_key  # Free at https://the-odds-api.com (500 req/month)
```

```bash
pnpm dev
```

## Project Structure

```
/src
  /app
    /api          — API routes (markets, analyze, paper-trade)
    layout.tsx    — Root layout (Inter font, dark theme tokens)
    page.tsx      — Home page
    globals.css   — Design system (color tokens, typography)
  /components
    PaperTrading  — Main dashboard with stats, controls, trade list
    PnlChart      — Portfolio performance area chart (recharts)
    TradeRow       — Expandable trade row with AI reasoning
    TradeCard      — Full trade recommendation card
    MarketTable    — Raw market data table
    AnalysisDashboard — Full analysis interface with tabs
  /lib
    kalshi.ts     — Kalshi API client (public, no auth)
    dedalus.ts    — AI analysis via Dedalus API
    store.ts      — Upstash Redis paper trade storage
  /types
    index.ts      — TypeScript interfaces
```

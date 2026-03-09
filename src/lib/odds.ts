/**
 * Sportsbook odds comparison engine.
 * Fetches real odds from DraftKings, FanDuel, etc. via The Odds API
 * and compares them to Kalshi prices to find genuine mispricings.
 *
 * This is the core quantitative edge — instead of asking an LLM to guess,
 * we compare Kalshi's implied probability against the consensus from
 * billion-dollar sportsbooks.
 */

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// Map Kalshi categories to The Odds API sport keys
const SPORT_KEY_MAP: Record<string, string> = {
  "NBA Basketball": "basketball_nba",
  "NHL Hockey": "icehockey_nhl",
  "NCAA Men's Basketball": "basketball_ncaab",
  "NFL Football": "americanfootball_nfl",
  "MLB Baseball": "baseball_mlb",
  "UFC / MMA": "mma_mixed_martial_arts",
  "Tennis": "tennis_atp_french_open", // varies by tournament
  "Soccer": "soccer_usa_mls",
};

// Map Kalshi team codes to common team names for matching
const TEAM_NAME_MAP: Record<string, string[]> = {
  // NBA
  ATL: ["Atlanta Hawks", "Hawks"], BOS: ["Boston Celtics", "Celtics"],
  BKN: ["Brooklyn Nets", "Nets"], CHA: ["Charlotte Hornets", "Hornets"],
  CHI: ["Chicago Bulls", "Bulls"], CLE: ["Cleveland Cavaliers", "Cavaliers"],
  DAL: ["Dallas Mavericks", "Mavericks"], DEN: ["Denver Nuggets", "Nuggets"],
  DET: ["Detroit Pistons", "Pistons"], GSW: ["Golden State Warriors", "Warriors"],
  HOU: ["Houston Rockets", "Rockets"], IND: ["Indiana Pacers", "Pacers"],
  LAC: ["LA Clippers", "Clippers"], LAL: ["Los Angeles Lakers", "Lakers", "LA Lakers"],
  MEM: ["Memphis Grizzlies", "Grizzlies"], MIA: ["Miami Heat", "Heat"],
  MIL: ["Milwaukee Bucks", "Bucks"], MIN: ["Minnesota Timberwolves", "Timberwolves"],
  NOP: ["New Orleans Pelicans", "Pelicans"], NYK: ["New York Knicks", "Knicks"],
  OKC: ["Oklahoma City Thunder", "Thunder"], ORL: ["Orlando Magic", "Magic"],
  PHI: ["Philadelphia 76ers", "76ers"], PHX: ["Phoenix Suns", "Suns"],
  POR: ["Portland Trail Blazers", "Trail Blazers"], SAC: ["Sacramento Kings", "Kings"],
  SAS: ["San Antonio Spurs", "Spurs"], TOR: ["Toronto Raptors", "Raptors"],
  UTA: ["Utah Jazz", "Jazz"], WAS: ["Washington Wizards", "Wizards"],
  // NHL
  ANA: ["Anaheim Ducks", "Ducks"], ARI: ["Arizona Coyotes", "Coyotes"],
  BUF: ["Buffalo Sabres", "Sabres"], CGY: ["Calgary Flames", "Flames"],
  CAR: ["Carolina Hurricanes", "Hurricanes"], COL: ["Colorado Avalanche", "Avalanche"],
  CBJ: ["Columbus Blue Jackets", "Blue Jackets"], EDM: ["Edmonton Oilers", "Oilers"],
  FLA: ["Florida Panthers", "Panthers"], LAK: ["Los Angeles Kings", "LA Kings"],
  MTL: ["Montreal Canadiens", "Canadiens"], NSH: ["Nashville Predators", "Predators"],
  NJD: ["New Jersey Devils", "Devils"], NYI: ["New York Islanders", "Islanders"],
  NYR: ["New York Rangers", "Rangers"], OTT: ["Ottawa Senators", "Senators"],
  PIT: ["Pittsburgh Penguins", "Penguins"], SJS: ["San Jose Sharks", "Sharks"],
  SEA: ["Seattle Kraken", "Kraken"], STL: ["St. Louis Blues", "Blues"],
  TBL: ["Tampa Bay Lightning", "Lightning"], VAN: ["Vancouver Canucks", "Canucks"],
  VGK: ["Vegas Golden Knights", "Golden Knights"], WPG: ["Winnipeg Jets", "Jets"],
  WSH: ["Washington Capitals", "Capitals"],
};

export interface SportsbookOdds {
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: {
    name: string;
    home_odds: number; // American odds
    away_odds: number;
    home_implied_prob: number; // 0-1
    away_implied_prob: number;
  }[];
  consensus: {
    home_implied_prob: number; // Average across books
    away_implied_prob: number;
    home_fair_prob: number; // Vig-removed
    away_fair_prob: number;
  };
}

export interface OddsComparison {
  ticker: string;
  kalshi_implied_prob: number;
  sportsbook_fair_prob: number;
  edge_pct: number; // positive = Kalshi underpriced (buy), negative = overpriced (sell/NO)
  confidence: "HIGH" | "MEDIUM" | "LOW";
  books_sampled: number;
  best_side: "YES" | "NO";
  detail: string;
}

/**
 * Convert American odds to implied probability.
 * +150 → 40%, -200 → 66.7%
 */
export function americanToImpliedProb(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Remove vig from a pair of implied probabilities to get fair probabilities.
 * Books charge ~5-10% vig, so implied probs sum to >100%.
 */
function removeVig(prob1: number, prob2: number): [number, number] {
  const total = prob1 + prob2;
  if (total === 0) return [0.5, 0.5];
  return [prob1 / total, prob2 / total];
}

/**
 * Fetch odds for a specific sport from The Odds API.
 */
async function fetchOddsForSport(sportKey: string): Promise<SportsbookOdds[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(`[odds] API error for ${sportKey}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results: SportsbookOdds[] = [];

    for (const event of data) {
      const bookmakers: SportsbookOdds["bookmakers"] = [];

      for (const book of event.bookmakers || []) {
        const h2h = book.markets?.find((m: { key: string }) => m.key === "h2h");
        if (!h2h?.outcomes || h2h.outcomes.length < 2) continue;

        const homeOutcome = h2h.outcomes.find(
          (o: { name: string }) => o.name === event.home_team
        );
        const awayOutcome = h2h.outcomes.find(
          (o: { name: string }) => o.name === event.away_team
        );

        if (!homeOutcome || !awayOutcome) continue;

        bookmakers.push({
          name: book.title || book.key,
          home_odds: homeOutcome.price,
          away_odds: awayOutcome.price,
          home_implied_prob: americanToImpliedProb(homeOutcome.price),
          away_implied_prob: americanToImpliedProb(awayOutcome.price),
        });
      }

      if (bookmakers.length === 0) continue;

      // Calculate consensus (average across all books)
      const avgHomeProb =
        bookmakers.reduce((s, b) => s + b.home_implied_prob, 0) / bookmakers.length;
      const avgAwayProb =
        bookmakers.reduce((s, b) => s + b.away_implied_prob, 0) / bookmakers.length;

      // Remove vig for fair probabilities
      const [homeFair, awayFair] = removeVig(avgHomeProb, avgAwayProb);

      results.push({
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        bookmakers,
        consensus: {
          home_implied_prob: avgHomeProb,
          away_implied_prob: avgAwayProb,
          home_fair_prob: homeFair,
          away_fair_prob: awayFair,
        },
      });
    }

    return results;
  } catch (e) {
    console.error(`[odds] Failed to fetch ${sportKey}:`, e);
    return [];
  }
}

/**
 * Try to match a Kalshi market ticker to a sportsbook event.
 * Returns the matched odds or null.
 */
function matchKalshiToSportsbook(
  ticker: string,
  title: string,
  odds: SportsbookOdds[]
): { matched: SportsbookOdds; isHome: boolean; teamCode: string } | null {
  // Extract team codes from ticker
  const match = ticker.match(
    /KX(?:NBA|NHL|NFL|MLB|NCAAM|NCAAW)\w*-\d{2}[A-Z]{3}\d{2}([A-Z]{2,4})([A-Z]{2,4})/
  );
  if (!match) return null;

  const [, team1Code, team2Code] = match;

  for (const event of odds) {
    const homeNorm = event.home_team.toLowerCase();
    const awayNorm = event.away_team.toLowerCase();

    // Try matching both team codes against both home/away
    for (const code of [team1Code, team2Code]) {
      const names = TEAM_NAME_MAP[code] || [];
      for (const name of names) {
        if (homeNorm.includes(name.toLowerCase())) {
          // This team is the home team — check if this is the YES side
          const lastPart = ticker.split("-").pop() || "";
          const isThisTeam = lastPart === code;
          return { matched: event, isHome: isThisTeam, teamCode: code };
        }
        if (awayNorm.includes(name.toLowerCase())) {
          const lastPart = ticker.split("-").pop() || "";
          const isThisTeam = lastPart === code;
          return { matched: event, isHome: !isThisTeam, teamCode: code };
        }
      }
    }

    // Fallback: match by title keywords
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes(event.home_team.toLowerCase().split(" ").pop()!) ||
      titleLower.includes(event.away_team.toLowerCase().split(" ").pop()!)
    ) {
      const lastPart = ticker.split("-").pop() || "";
      // Check if the last part of the ticker matches a team
      const homeNames = Object.entries(TEAM_NAME_MAP).find(([, names]) =>
        names.some((n) => event.home_team.toLowerCase().includes(n.toLowerCase()))
      );
      const isHome = homeNames?.[0] === lastPart;
      return { matched: event, isHome: !!isHome, teamCode: lastPart };
    }
  }

  return null;
}

/**
 * Compare Kalshi market prices against sportsbook consensus odds.
 * This is the core quantitative edge finder.
 *
 * Returns a comparison for each market that has matching sportsbook odds.
 */
export async function compareOdds(
  markets: { ticker: string; title: string; category: string; yes_ask: number; no_ask: number }[]
): Promise<OddsComparison[]> {
  if (!process.env.ODDS_API_KEY) return [];

  // Determine which sports we need odds for
  const sportsNeeded = new Set<string>();
  for (const m of markets) {
    const sportKey = SPORT_KEY_MAP[m.category];
    if (sportKey) sportsNeeded.add(sportKey);
  }

  if (sportsNeeded.size === 0) return [];

  // Fetch odds for all needed sports in parallel
  const oddsResults = await Promise.all(
    [...sportsNeeded].map(async (sport) => ({
      sport,
      odds: await fetchOddsForSport(sport),
    }))
  );

  const oddsBySport = new Map<string, SportsbookOdds[]>();
  for (const r of oddsResults) {
    oddsBySport.set(r.sport, r.odds);
  }

  // Compare each Kalshi market against sportsbook odds
  const comparisons: OddsComparison[] = [];

  for (const market of markets) {
    const sportKey = SPORT_KEY_MAP[market.category];
    if (!sportKey) continue;

    const sportOdds = oddsBySport.get(sportKey);
    if (!sportOdds || sportOdds.length === 0) continue;

    const match = matchKalshiToSportsbook(market.ticker, market.title, sportOdds);
    if (!match) continue;

    const { matched, isHome } = match;

    // Get sportsbook fair probability for the YES side of this Kalshi market
    // The ticker's last segment tells us which team YES refers to
    const lastPart = market.ticker.split("-").pop() || "";
    let sportsbookFairProb: number;
    let teamName: string;

    // Figure out which team the YES side represents
    const homeNames = TEAM_NAME_MAP[lastPart] || [];
    const isYesHome = homeNames.some((n) =>
      matched.home_team.toLowerCase().includes(n.toLowerCase())
    );

    if (isYesHome) {
      sportsbookFairProb = matched.consensus.home_fair_prob;
      teamName = matched.home_team;
    } else {
      sportsbookFairProb = matched.consensus.away_fair_prob;
      teamName = matched.away_team;
    }

    // Kalshi's implied probability = YES ask price
    const kalshiImplied = market.yes_ask;

    // Edge = sportsbook fair prob - Kalshi implied prob
    // Positive edge = Kalshi underpricing (buy YES)
    // Negative edge = Kalshi overpricing (buy NO)
    const edge = (sportsbookFairProb - kalshiImplied) * 100;

    // Confidence based on number of books and edge size
    const numBooks = matched.bookmakers.length;
    let confidence: "HIGH" | "MEDIUM" | "LOW";
    if (numBooks >= 5 && Math.abs(edge) >= 8) confidence = "HIGH";
    else if (numBooks >= 3 && Math.abs(edge) >= 5) confidence = "MEDIUM";
    else confidence = "LOW";

    const bestSide = edge > 0 ? "YES" : "NO";
    const bestPrice = bestSide === "YES" ? market.yes_ask : market.no_ask;

    comparisons.push({
      ticker: market.ticker,
      kalshi_implied_prob: kalshiImplied,
      sportsbook_fair_prob: sportsbookFairProb,
      edge_pct: edge,
      confidence,
      books_sampled: numBooks,
      best_side: bestSide,
      detail: `${teamName}: Kalshi ${(kalshiImplied * 100).toFixed(0)}% vs sportsbooks ${(sportsbookFairProb * 100).toFixed(0)}% (${numBooks} books, vig-removed). Edge: ${edge > 0 ? "+" : ""}${edge.toFixed(1)}% → ${bestSide} @ $${bestPrice.toFixed(2)}`,
    });
  }

  // Sort by absolute edge (biggest mispricings first)
  comparisons.sort((a, b) => Math.abs(b.edge_pct) - Math.abs(a.edge_pct));

  return comparisons;
}

/**
 * Build an odds comparison context string for the AI prompt.
 */
export async function buildOddsContext(
  markets: { ticker: string; title: string; category: string; yes_ask: number; no_ask: number }[]
): Promise<string> {
  const comparisons = await compareOdds(markets);
  if (comparisons.length === 0) return "";

  const lines = [
    "=== SPORTSBOOK ODDS COMPARISON (real money lines from DraftKings, FanDuel, etc.) ===",
    "These are vig-removed fair probabilities from major sportsbooks. When Kalshi disagrees with sportsbooks, that's your edge.",
    "",
  ];

  for (const c of comparisons) {
    const emoji = c.confidence === "HIGH" ? "STRONG EDGE" : c.confidence === "MEDIUM" ? "EDGE" : "SMALL EDGE";
    lines.push(`[${emoji}] ${c.detail}`);
  }

  lines.push("");
  return lines.join("\n");
}

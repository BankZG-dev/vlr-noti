import axios from 'axios';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import { chromium, Browser, Page } from 'playwright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchSummary {
  url: string;
  time: string;
  status: string; // "LIVE" | "Upcoming" | finished time string
  team1: string;
  team2: string;
  score1?: string;
  score2?: string;
  event: string;
}

export interface PlayerStat {
  name: string;
  agent?: string;
  rating: string;
  acs: string;
  kda: string;
  kills: string;
  deaths: string;
  assists: string;
  adr: string;
  hsPercent: string;
  fk: string;
  fd: string;
  plusMinus?: string;
}

export interface MapResult {
  name: string;
  score: string; // e.g. "13-7"
  team1Stats: PlayerStat[];
  team2Stats: PlayerStat[];
}

export interface MatchDetails {
  team1: string;
  team2: string;
  score1: string; // series score
  score2: string;
  status: string;
  event: string;
  maps: MapResult[];
  allMapsStats?: {
    team1Stats: PlayerStat[];
    team2Stats: PlayerStat[];
  };
}

export interface TournamentStage {
  name: string; // e.g. "Group Stage A", "Playoffs"
  matches: MatchSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'https://www.vlr.gg';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      },
      timeout: 10000,
    });
    return cheerio.load(data);
  } catch (err) {
    console.error(`[scraper] Failed to fetch ${url}:`, err);
    return null;
  }
}

async function fetchPageWithBrowser(url: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for JS to render
    const content = await page.content();
    await page.close();
    return cheerio.load(content);
  } catch (err) {
    console.error(`[scraper] Failed to fetch with browser ${url}:`, err);
    return null;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseMatchItem($: cheerio.CheerioAPI, el: Element): MatchSummary | null {
  const href = $(el).attr('href');
  if (!href) return null;

  const team1 = normalizeText($(el).find('.match-item-vs-team-name').eq(0).text());
  const team2 = normalizeText($(el).find('.match-item-vs-team-name').eq(1).text());
  if (!team1 || !team2) return null;

  const rawStatus = normalizeText($(el).find('.ml-status').text());
  const time = normalizeText($(el).find('.match-item-time').text());
  const score1 = normalizeText($(el).find('.match-item-vs-team-score').eq(0).text());
  const score2 = normalizeText($(el).find('.match-item-vs-team-score').eq(1).text());
  const event = normalizeText($(el).find('.match-item-event').text());

  return {
    url: `${BASE}${href}`,
    time,
    status: rawStatus || time,
    team1,
    team2,
    score1: score1 || undefined,
    score2: score2 || undefined,
    event,
  };
}

// ---------------------------------------------------------------------------
// getUpcomingMatches — used by polling job
// ---------------------------------------------------------------------------

export async function getUpcomingMatches(): Promise<MatchSummary[]> {
  const $ = await fetchPage(`${BASE}/matches`);
  if (!$) return [];

  const matches: MatchSummary[] = [];
  $('.wf-card .match-item').each((_, el) => {
    const m = parseMatchItem($, el);
    if (m) matches.push(m);
  });
  return matches;
}

// ---------------------------------------------------------------------------
// getRecentResults — used by /results command
// ---------------------------------------------------------------------------

export async function getRecentResults(teamSearch?: string): Promise<MatchSummary[]> {
  const $ = await fetchPage(`${BASE}/matches/results`);
  if (!$) return [];

  const matches: MatchSummary[] = [];
  $('.wf-card .match-item').each((_, el) => {
    const m = parseMatchItem($, el);
    if (!m) return;
    if (
      teamSearch &&
      !m.team1.toLowerCase().includes(teamSearch.toLowerCase()) &&
      !m.team2.toLowerCase().includes(teamSearch.toLowerCase())
    ) {
      return;
    }
    matches.push(m);
  });
  return matches;
}

// ---------------------------------------------------------------------------
// getTeamUpcoming — used by /upcoming command
// ---------------------------------------------------------------------------

export async function getTeamUpcoming(teamSearch: string): Promise<MatchSummary[]> {
  // VLR search to find the team page first
  const searchUrl = `${BASE}/search/?q=${encodeURIComponent(teamSearch)}&type=teams`;
  const $s = await fetchPage(searchUrl);
  if (!$s) return [];

  // Grab first team result href
  const teamHref = $s('.wf-module-item').first().attr('href');
  if (!teamHref) return [];

  // Fetch team page and find upcoming matches tab
  const teamUrl = `${BASE}${teamHref}`;
  const $t = await fetchPage(teamUrl);
  if (!$t) return [];

  const matches: MatchSummary[] = [];
  $t('.wf-card .match-item').each((_, el) => {
    const m = parseMatchItem($t, el);
    if (m) matches.push(m);
  });

  // Filter to only future/upcoming (status is not a score)
  return matches.filter(
    (m) => m.status.toUpperCase().includes('UPCOMING') || m.status.match(/^\d{1,2}:\d{2}/)
  );
}

// ---------------------------------------------------------------------------
// getMatchDetails — used by /results drill-down and post-match notification
// ---------------------------------------------------------------------------

function getCellValue(cell: cheerio.Cheerio<Element>): string {
  return normalizeText(cell.text());
}

function getCellText(cell: cheerio.Cheerio<Element>): string {
  return normalizeText(cell.text());
}

function parseScore(value: string): [number, number] | null {
  const score = normalizeText(value).replace(/\u2013/g, '-');
  const match = score.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

type StatColumns = {
  player: number;
  agent: number;
  rating: number;
  acs: number;
  kda: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  hsPercent: number;
  fk: number;
  fd: number;
  plusMinus: number;
};

function normalizeHeader(text: string): string {
  return normalizeText(text).toLowerCase().replace('%', ' percent');
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number | undefined {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function buildStatColumns(headers: string[]): StatColumns {
  // VLR stat table columns in order: R | ACS | K | D | A | +/– | KAST | ADR | HS% | FK | FD | +/–
  // Player name is in row text, agent is in img
  return {
    player: -1, // Extracted from row text
    agent: -1,  // Extracted from img
    rating: 0,  // R
    acs: 1,     // ACS
    kda: -1,    // Computed from K/D/A
    kills: 2,   // K
    deaths: 3,  // D
    assists: 4, // A
    adr: 7,     // ADR
    hsPercent: 8, // HS%
    fk: 9,      // FK
    fd: 10,     // FD
    plusMinus: 5, // +/– first occurrence
  };
}

function parsePlayerRow(
  $: cheerio.CheerioAPI,
  el: Element,
  columns: StatColumns
): PlayerStat {
  const cells = $(el).find('td');

  // Get player name - try different approaches
  let playerName = '';
  if (columns.player >= 0) {
    const nameCell = cells.eq(columns.player);
    playerName = normalizeText(nameCell.find('.text-of').text());
    if (!playerName) {
      playerName = normalizeText(nameCell.text());
    }
  } else {
    // Player name might be in the row header or first cell
    playerName = normalizeText($(el).find('th').text()) || normalizeText(cells.eq(0).text());
  }

  // Get agent
  let agent = '';
  if (columns.agent >= 0) {
    agent = cells.eq(columns.agent).find('img').attr('alt') || '';
  } else {
    // Agent might be in an img in the row
    agent = $(el).find('img').attr('alt') || '';
  }

  // Extract stats using column mapping
  const rating = columns.rating >= 0 ? getCellText(cells.eq(columns.rating)) : '0';
  const acs = columns.acs >= 0 ? getCellText(cells.eq(columns.acs)) : '0';
  const kills = columns.kills >= 0 ? getCellText(cells.eq(columns.kills)) : '0';
  const deaths = columns.deaths >= 0 ? getCellText(cells.eq(columns.deaths)) : '0';
  const assists = columns.assists >= 0 ? getCellText(cells.eq(columns.assists)) : '0';
  const adr = columns.adr >= 0 ? getCellText(cells.eq(columns.adr)) : '0';
  const hsPercent = columns.hsPercent >= 0 ? getCellText(cells.eq(columns.hsPercent)) : '0';
  const fk = columns.fk >= 0 ? getCellText(cells.eq(columns.fk)) : '0';
  const fd = columns.fd >= 0 ? getCellText(cells.eq(columns.fd)) : '0';
  const plusMinus = columns.plusMinus >= 0 ? getCellText(cells.eq(columns.plusMinus)) : '';

  const kda = `${kills}/${deaths}/${assists}`;

  return {
    name: playerName,
    agent,
    rating,
    acs,
    kda,
    kills,
    deaths,
    assists,
    adr,
    hsPercent,
    fk,
    fd,
    plusMinus,
  };
}

export async function getMatchDetails(matchUrl: string): Promise<MatchDetails | null> {
  // Use browser for JS-rendered stats pages
  const $ = await fetchPageWithBrowser(matchUrl);
  if (!$) return null;

  const team1 = normalizeText($('.match-header-link-name').eq(0).text());
  const team2 = normalizeText($('.match-header-link-name').eq(1).text());

  // Series score — the two non-separator spans inside .js-spoiler
  const scoreSpans = $('.match-header-vs-score .js-spoiler span').filter(
    (_, el) => !$(el).hasClass('match-header-vs-score-colon')
  );
  const score1 = normalizeText(scoreSpans.eq(0).text());
  const score2 = normalizeText(scoreSpans.eq(1).text());

  const status = normalizeText($('.match-header-vs-note').eq(1).text()) ||
                 normalizeText($('.match-header-vs-note').first().text());
  const event = normalizeText($('.match-header-event').text());

  // Per-map stats
  const maps: MapResult[] = [];
  let allMapsStats: { team1Stats: PlayerStat[]; team2Stats: PlayerStat[] } | undefined;

  // Each game panel has a nav item (for name/score) and a stats table
  $('.vm-stats-game').each((i, gameEl) => {
    const gameId = $(gameEl).attr('data-game-id');
    const isAllMaps = gameId === 'all';

    const mapName = normalizeText(
      $(`.vm-stats-gamesnav-item[data-game-id="${gameId}"]`)
        .find('div')
        .first()
        .text()
    );

    let mapScore = normalizeText(
      $(`.vm-stats-gamesnav-item[data-game-id="${gameId}"]`)
        .find('.vm-stats-gamesnav-item-score')
        .text()
    );

    // If no score found in nav, try to extract from table headers or other elements
    if (!mapScore || !parseScore(mapScore)) {
      // Try to find score in the game element
      const scoreInGame = $(gameEl).find('.vm-stats-game-header-score').text();
      if (scoreInGame) {
        mapScore = normalizeText(scoreInGame);
      }

      // Try to parse from team scores in the tables
      if (!mapScore || !parseScore(mapScore)) {
        const team1Score = $(gameEl).find('.wf-table-inset.mod-overview').eq(0).find('thead .team-score').text();
        const team2Score = $(gameEl).find('.wf-table-inset.mod-overview').eq(1).find('thead .team-score').text();
        if (team1Score && team2Score) {
          mapScore = `${normalizeText(team1Score)}-${normalizeText(team2Score)}`;
        }
      }
    }

    const team1Stats: PlayerStat[] = [];
    const team2Stats: PlayerStat[] = [];

    // Two tables per map — first = team1, second = team2
    $(gameEl).find('.wf-table-inset.mod-overview').each((tableIdx, tableEl) => {
      const headerCells = $(tableEl).find('thead tr').first().find('th');
      const headers = headerCells.length
        ? headerCells
            .map((_, th) => normalizeText($(th).text()))
            .get()
        : [];
      const columns = buildStatColumns(headers);

      $(tableEl)
        .find('tbody tr')
        .each((_, row) => {
          const stat = parsePlayerRow($, row, columns);
          if (stat.name) {
            if (tableIdx === 0) team1Stats.push(stat);
            else team2Stats.push(stat);
          }
        });
    });

    if (isAllMaps) {
      allMapsStats = { team1Stats, team2Stats };
      return;
    }

    if (mapName && mapName !== 'All Maps') {
      maps.push({
        name: mapName,
        score: mapScore || 'N/A',
        team1Stats,
        team2Stats,
      });
    }
  });

  return { team1, team2, score1, score2, status, event, maps, allMapsStats };
}

// ---------------------------------------------------------------------------
// getTournamentMatches — used by /tournament command
// ---------------------------------------------------------------------------

export async function getTournamentMatches(tournamentSearch: string): Promise<TournamentStage[]> {
  // Search for the event
  const searchUrl = `${BASE}/search/?q=${encodeURIComponent(tournamentSearch)}&type=events`;
  const $s = await fetchPage(searchUrl);
  if (!$s) return [];

  const eventHref = $s('.wf-module-item').first().attr('href');
  if (!eventHref) return [];

  // VLR event match pages follow /event/matches/<id>/<slug>
  // Convert /event/<id>/<slug> → /event/matches/<id>/<slug>
  const matchesPath = eventHref.replace('/event/', '/event/matches/');
  const $m = await fetchPage(`${BASE}${matchesPath}`);
  if (!$m) return [];

  const stages: TournamentStage[] = [];
  let currentStage: TournamentStage | null = null;

  // VLR groups matches under .wf-label headers
  $m('.wf-label, .wf-card .match-item').each((_, el) => {
    if ($m(el).hasClass('wf-label')) {
      const stageName = normalizeText($m(el).text());
      currentStage = { name: stageName, matches: [] };
      stages.push(currentStage);
    } else {
      if (!currentStage) {
        currentStage = { name: 'Matches', matches: [] };
        stages.push(currentStage);
      }
      const m = parseMatchItem($m, el);
      if (m) currentStage.matches.push(m);
    }
  });

  return stages;
}
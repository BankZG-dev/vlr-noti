import axios from 'axios';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';

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
  agent: string;
  acs: string;
  kills: string;
  deaths: string;
  assists: string;
  kastPct: string;
  adr: string;
  hsPercent: string;
  fk: string;
  fd: string;
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
}

export interface TournamentStage {
  name: string; // e.g. "Group Stage A", "Playoffs"
  matches: MatchSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'https://www.vlr.gg';

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
  return normalizeText(cell.text()).split(/\s+/)[0] || '';
}

function parsePlayerRow($: cheerio.CheerioAPI, el: Element): PlayerStat {
  const cells = $(el).find('td');
  return {
    name: normalizeText($(cells[0]).find('.text-of').text()) || normalizeText($(cells[0]).text()),
    agent: $(cells[1]).find('img').attr('alt') || '',
    acs: normalizeText($(cells[2]).text()),
    kills: normalizeText($(cells[3]).text()),
    deaths: normalizeText($(cells[4]).text()),
    assists: normalizeText($(cells[5]).text()),
    kastPct: normalizeText($(cells[6]).text()),
    adr: normalizeText($(cells[7]).text()),
    hsPercent: normalizeText($(cells[8]).text()),
    fk: normalizeText($(cells[9]).text()),
    fd: normalizeText($(cells[10]).text()),
  };
}

export async function getMatchDetails(matchUrl: string): Promise<MatchDetails | null> {
  const $ = await fetchPage(matchUrl);
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

  // Each game panel has a nav item (for name/score) and a stats table
  $('.vm-stats-game').each((i, gameEl) => {
    // Skip the "All Maps" summary panel (data-game-id="all")
    if ($(gameEl).attr('data-game-id') === 'all') return;

    const mapName = normalizeText(
      $(`.vm-stats-gamesnav-item[data-game-id="${$(gameEl).attr('data-game-id')}"]`)
        .find('div')
        .first()
        .text()
    );

    // Score from the nav item
    const mapScore = normalizeText(
      $(`.vm-stats-gamesnav-item[data-game-id="${$(gameEl).attr('data-game-id')}"]`)
        .find('.vm-stats-gamesnav-item-score')
        .text()
    );

    const team1Stats: PlayerStat[] = [];
    const team2Stats: PlayerStat[] = [];

    // Two tables per map — first = team1, second = team2
    $(gameEl).find('.wf-table-inset.mod-overview').each((tableIdx, tableEl) => {
      $(tableEl)
        .find('tbody tr')
        .each((_, row) => {
          const stat = parsePlayerRow($, row);
          if (stat.name) {
            if (tableIdx === 0) team1Stats.push(stat);
            else team2Stats.push(stat);
          }
        });
    });

    if (mapName && mapName !== 'All Maps') {
      maps.push({
        name: mapName,
        score: mapScore || 'N/A',
        team1Stats,
        team2Stats,
      });
    }
  });

  return { team1, team2, score1, score2, status, event, maps };
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
import { EmbedBuilder } from 'discord.js';
import { MatchDetails, MatchSummary, PlayerStat, TournamentStage, MapResult } from '../src/scraper/vlr';

const VLR_RED = 0xff4655;
const VLR_GREEN = 0x3ba55d;
const VLR_GREY = 0x2f3136;

// ---------------------------------------------------------------------------
// Live match notification embed
// ---------------------------------------------------------------------------
export function buildLiveEmbed(match: MatchSummary): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(VLR_RED)
    .setTitle(`🔴 LIVE NOW: ${match.team1} vs ${match.team2}`)
    .setURL(match.url)
    .setDescription(`**${match.event}**`)
    .setFooter({ text: 'vlr.gg' })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// 10-minute warning embed
// ---------------------------------------------------------------------------
export function buildUpcomingWarningEmbed(match: MatchSummary): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle(`⏰ Match Starting Soon: ${match.team1} vs ${match.team2}`)
    .setURL(match.url)
    .setDescription(`**${match.event}**\nStarting in approximately 10 minutes.`)
    .setFooter({ text: 'vlr.gg' })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Post-match result embed (overall score)
// ---------------------------------------------------------------------------
function parseScore(value: string): [number, number] | null {
  const normalized = value.replace(/\u2013/g, '-').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function getMapWinner(map: MapResult, team1: string, team2: string): string {
  const parts = parseScore(map.score);
  if (!parts) return 'Unknown';
  const [score1, score2] = parts;
  if (score1 > score2) return team1;
  if (score2 > score1) return team2;
  return 'Draw';
}

function parseStatNumber(value: string): number {
  const parsed = Number(value.replace(/[^\d\.]/g, '').trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

function comparePlayerStats(a: PlayerStat, b: PlayerStat): number {
  const aRating = parseStatNumber(a.rating);
  const bRating = parseStatNumber(b.rating);
  if (aRating !== bRating) return aRating - bRating;
  const aAcs = parseStatNumber(a.acs);
  const bAcs = parseStatNumber(b.acs);
  if (aAcs !== bAcs) return aAcs - bAcs;
  const aKills = parseStatNumber(a.kills);
  const bKills = parseStatNumber(b.kills);
  if (aKills !== bKills) return aKills - bKills;
  const aAdr = parseStatNumber(a.adr);
  const bAdr = parseStatNumber(b.adr);
  return aAdr - bAdr;
}

function findMapMVP(players: PlayerStat[]): PlayerStat | null {
  return players.reduce((best: PlayerStat | null, player) => {
    if (!best) return player;
    return comparePlayerStats(player, best) > 0 ? player : best;
  }, null);
}

function findOverallMVP(details: MatchDetails): { stat: PlayerStat; rating: number } | null {
  if (details.allMapsStats) {
    const allPlayers = [...details.allMapsStats.team1Stats, ...details.allMapsStats.team2Stats];
    const winner = findMapMVP(allPlayers);
    return winner ? { stat: winner, rating: parseStatNumber(winner.rating) } : null;
  }

  const totals = new Map<string, { stat: PlayerStat; rating: number; acs: number; kills: number; adr: number }>();
  const addStats = (player: PlayerStat) => {
    const name = player.name;
    const rating = parseStatNumber(player.rating);
    const acs = parseStatNumber(player.acs);
    const kills = parseStatNumber(player.kills);
    const adr = parseStatNumber(player.adr);
    const existing = totals.get(name);
    if (existing) {
      totals.set(name, {
        stat: existing.stat,
        rating: existing.rating + rating,
        acs: existing.acs + acs,
        kills: existing.kills + kills,
        adr: existing.adr + adr,
      });
    } else {
      totals.set(name, { stat: player, rating, acs, kills, adr });
    }
  };

  details.maps.forEach((map) => {
    map.team1Stats.forEach(addStats);
    map.team2Stats.forEach(addStats);
  });

  let best: { stat: PlayerStat; rating: number; acs: number; kills: number; adr: number } | null = null;
  for (const value of totals.values()) {
    if (!best) {
      best = value;
      continue;
    }
    if (value.rating !== best.rating) {
      best = value.rating > best.rating ? value : best;
      continue;
    }
    if (value.acs !== best.acs) {
      best = value.acs > best.acs ? value : best;
      continue;
    }
    if (value.kills !== best.kills) {
      best = value.kills > best.kills ? value : best;
      continue;
    }
    if (value.adr !== best.adr) {
      best = value.adr > best.adr ? value : best;
    }
  }
  return best ? { stat: best.stat, rating: best.rating } : null;
}

function formatOrdinal(index: number): string {
  if (index === 1) return '1st';
  if (index === 2) return '2nd';
  if (index === 3) return '3rd';
  return `${index}th`;
}

function buildMapLabel(name: string, index: number): string {
  const trimmed = name.trim();
  if (/^(\d+|\d+(st|nd|rd|th))\b/.test(trimmed)) {
    return trimmed;
  }
  return `${formatOrdinal(index + 1)} ${trimmed}`;
}

function getTeamAbbrev(teamName: string): string {
  // Common team abbreviations
  const commonAbbrevs: Record<string, string> = {
    'Full Sense': 'FS',
    'NRG': 'NRG',
    'T1': 'T1',
    'Team Liquid': 'TL',
    'Cloud9': 'C9',
    'Sentinels': 'SEN',
    '100 Thieves': '100T',
    'G2 Esports': 'G2',
    'Fnatic': 'FNC',
    'FURIA': 'FUR',
    'Leviatán': 'LEV',
    'Loud': 'LOUD',
    'KRÜ': 'KRÜ',
    'MIBR': 'MBR',
    'EDward Gaming': 'EDG',
    'FunPlus Phoenix': 'FPX',
    'Titan': 'TT',
    'Rex Regum Qeon': 'RRQ',
    'Global Esports': 'GE',
    'DetonatioN FocusMe': 'DFM',
    'ZETA DIVISION': 'ZETA',
    'Bleed': 'BLD',
    'DRX': 'DRX',
    'Gen.G': 'GEN',
    'Natus Vincere': 'NAVI',
    'Paper Rex': 'PRX',
    'Team Secret': 'TS',
    'Trace Esports': 'TRACE',
    'BOOM Esports': 'BOOM',
    'Talon Esports': 'TALON',
  };

  if (commonAbbrevs[teamName]) return commonAbbrevs[teamName];

  // Fallback: take first 2-3 letters, avoiding common words
  const words = teamName.split(' ');
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }

  // For multi-word names, take first letter of each word
  const abbrev = words.slice(0, 3).map(word => word.charAt(0)).join('').toUpperCase();
  return abbrev.length <= 3 ? abbrev : abbrev.substring(0, 3);
}

function extractFirstNumber(value: string): string {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : '0';
}

export function buildResultEmbed(details: MatchDetails, matchUrl: string): EmbedBuilder {
  const winnerName = getMapWinner({ name: 'Final', score: `${details.score1}-${details.score2}`, team1Stats: [], team2Stats: [] }, details.team1, details.team2);
  const overallMvp = findOverallMVP(details);
  const overallMvpText = overallMvp ? `${overallMvp.stat.name} (${overallMvp.rating.toFixed(2)} Rating)` : 'N/A';
  const embedColor = winnerName === details.team1 ? VLR_GREEN : winnerName === details.team2 ? VLR_RED : VLR_GREY;

  const mapLines = details.maps
    .map((m: MapResult, index) => {
      const scoreParts = parseScore(m.score);
      if (!scoreParts) return `Map ${buildMapLabel(m.name, index)}: Unknown`;

      const [score1, score2] = scoreParts;
      const team1Abbrev = getTeamAbbrev(details.team1);
      const team2Abbrev = getTeamAbbrev(details.team2);

      return `Map ${buildMapLabel(m.name, index)}: ${team1Abbrev} ${score1} - ${score2} ${team2Abbrev}`;
    })
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`✅ Match Over: ${details.team1} [${details.score1}–${details.score2}] ${details.team2}`)
    .setURL(matchUrl)
    .addFields(
      { name: 'Event', value: details.event || 'N/A', inline: true },
      { name: 'Series Score', value: `${details.score1} – ${details.score2}`, inline: true },
      { name: 'Winner', value: winnerName, inline: true },
      { name: 'Overall MVP', value: overallMvpText, inline: true },
      { name: 'Map Results', value: mapLines || 'No map data', inline: false }
    )
    .setFooter({ text: 'vlr.gg' })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Per-map player stats embed (used as thread messages)
// ---------------------------------------------------------------------------
function statTable(players: PlayerStat[]): string {
  if (players.length === 0) return '_No data_';
  const header = '`Player         | Rating | ACS  | K/D/A   | HS% | FK | FD`';
  const rows = players.map((p) => {
    const name = p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name.padEnd(12);
    const rating = parseStatNumber(p.rating).toFixed(2).padStart(5);
    const acsValue = parseStatNumber(p.acs);
    const acs = Number.isFinite(acsValue) ? acsValue.toFixed(0).padStart(5) : '    0';
    const kda = p.kda || `${extractFirstNumber(p.kills)}/${extractFirstNumber(p.deaths)}/${extractFirstNumber(p.assists)}`.padEnd(7);
    const hs = extractFirstNumber(p.hsPercent).padStart(3);
    const fk = extractFirstNumber(p.fk).padStart(2);
    const fd = extractFirstNumber(p.fd).padStart(2);
    return `\`${name} | ${rating} | ${acs} | ${kda} | ${hs}% | ${fk} | ${fd}\``;
  });
  return [header, ...rows].join('\n');
}

export function buildMapStatsEmbeds(details: MatchDetails): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  if (details.allMapsStats) {
    const mvp = findMapMVP([...details.allMapsStats.team1Stats, ...details.allMapsStats.team2Stats]);
    const mvpText = mvp ? `${mvp.name} — ${parseStatNumber(mvp.rating).toFixed(2)} Rating` : 'N/A';

    embeds.push(
      new EmbedBuilder()
        .setColor(VLR_GREY)
        .setTitle('🗺️ All Maps')
        .addFields(
          {
            name: details.team1,
            value: statTable(details.allMapsStats.team1Stats),
            inline: false,
          },
          {
            name: details.team2,
            value: statTable(details.allMapsStats.team2Stats),
            inline: false,
          },
          {
            name: 'Match MVP',
            value: mvpText,
            inline: false,
          }
        )
    );
  }

  details.maps.forEach((map: MapResult) => {
    const winner = getMapWinner(map, details.team1, details.team2);
    const mapColor = winner === details.team1 ? VLR_GREEN : winner === details.team2 ? VLR_RED : VLR_GREY;
    const team1Label = winner === details.team1 ? `✅ ${details.team1}` : details.team1;
    const team2Label = winner === details.team2 ? `✅ ${details.team2}` : details.team2;
    const mvp = findMapMVP([...map.team1Stats, ...map.team2Stats]);
    const mvpText = mvp ? `${mvp.name} — ${parseStatNumber(mvp.rating).toFixed(2)} Rating` : 'N/A';

    embeds.push(
      new EmbedBuilder()
        .setColor(mapColor)
        .setTitle(`🗺️ ${map.name} — ${winner}`)
        .addFields(
          {
            name: team1Label,
            value: statTable(map.team1Stats),
            inline: false,
          },
          {
            name: team2Label,
            value: statTable(map.team2Stats),
            inline: false,
          },
          {
            name: 'Map MVP',
            value: mvpText,
            inline: false,
          }
        )
    );
  });

  return embeds;
}

// ---------------------------------------------------------------------------
// Tournament stages embed
// ---------------------------------------------------------------------------
export function buildTournamentEmbeds(
  tournamentName: string,
  stages: TournamentStage[]
): EmbedBuilder[] {
  return stages.map((stage) => {
    const lines = stage.matches.slice(0, 15).map((m: MatchSummary) => {
      const score =
        m.score1 && m.score2
          ? ` — **${m.score1}–${m.score2}**`
          : '';
      const statusTag =
        m.status.toUpperCase() === 'LIVE' ? ' 🔴' : '';
      return `[${m.team1} vs ${m.team2}${score}${statusTag}](${m.url})`;
    });

    return new EmbedBuilder()
      .setColor(VLR_RED)
      .setTitle(`🏆 ${tournamentName} — ${stage.name}`)
      .setDescription(lines.join('\n') || '_No matches found_')
      .setFooter({ text: 'vlr.gg · up to 15 matches shown per stage' });
  });
}

// ---------------------------------------------------------------------------
// Upcoming matches embed
// ---------------------------------------------------------------------------
export function buildUpcomingEmbed(team: string, matches: MatchSummary[]): EmbedBuilder {
  const lines = matches.slice(0, 10).map(
    (m) => `[${m.team1} vs ${m.team2}](${m.url})\n> ${m.event} · ${m.time || m.status}`
  );

  return new EmbedBuilder()
    .setColor(VLR_RED)
    .setTitle(`📅 Upcoming Matches — ${team}`)
    .setDescription(lines.join('\n\n') || '_No upcoming matches found_')
    .setFooter({ text: 'vlr.gg' });
}

// ---------------------------------------------------------------------------
// Live map updates embed (during match)
// ---------------------------------------------------------------------------
export function buildMapUpdateEmbed(team1: string, team2: string, maps: MapResult[]): EmbedBuilder {
  const mapLines = maps
    .map((m) => {
      const scoreParts = parseScore(m.score);
      if (!scoreParts) return `**${m.name}**: ${m.score}`;
      const [score1, score2] = scoreParts;
      const indicator = score1 > score2 ? `${team1} 🟢` : score2 > score1 ? `${team2} 🟢` : '⚪';
      return `**${m.name}**: ${score1}-${score2} (${indicator})`;
    })
    .join('\n');

  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle(`🔴 LIVE: Current Map Scores`)
    .setDescription(mapLines || 'No maps started yet')
    .setFooter({ text: 'Updates every 2 minutes' });
}

// ---------------------------------------------------------------------------
// Upcoming warning with Twitch links
// ---------------------------------------------------------------------------
export interface TwitchLinks {
  pacific?: string;
  na?: string;
  eu?: string;
  cn?: string;
  champions?: string;
}

export function buildUpcomingWarningEmbedWithTwitch(
  match: MatchSummary,
  twitchLinks?: TwitchLinks
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle(`⏰ Match Starting Soon: ${match.team1} vs ${match.team2}`)
    .setURL(match.url)
    .setDescription(`**${match.event}**\nStarting in approximately 10 minutes.`);

  if (twitchLinks && Object.keys(twitchLinks).length > 0) {
    const twitchLines = Object.entries(twitchLinks)
      .filter(([_, url]) => url)
      .map(([region, url]) => {
        const regionName = region.charAt(0).toUpperCase() + region.slice(1);
        return `[📺 ${regionName}](${url})`;
      });
    
    if (twitchLines.length > 0) {
      embed.addFields({
        name: 'Watch on Twitch',
        value: twitchLines.join(' | '),
        inline: false
      });
    }
  }

  embed.setFooter({ text: 'vlr.gg' });
  return embed;
}
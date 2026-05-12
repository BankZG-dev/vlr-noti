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
function getMapWinner(map: MapResult, team1: string, team2: string): string {
  const parts = map.score.split('-').map((item) => parseInt(item.trim(), 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return 'Unknown';
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

function findOverallMVP(details: MatchDetails): PlayerStat | null {
  const totals = new Map<string, { stat: PlayerStat; acs: number; kills: number; adr: number }>();
  const addStats = (player: PlayerStat) => {
    const name = player.name;
    const acs = parseStatNumber(player.acs);
    const kills = parseStatNumber(player.kills);
    const adr = parseStatNumber(player.adr);
    const existing = totals.get(name);
    if (existing) {
      totals.set(name, {
        stat: player,
        acs: existing.acs + acs,
        kills: existing.kills + kills,
        adr: existing.adr + adr,
      });
    } else {
      totals.set(name, { stat: player, acs, kills, adr });
    }
  };

  details.maps.forEach((map) => {
    map.team1Stats.forEach(addStats);
    map.team2Stats.forEach(addStats);
  });

  let best: { stat: PlayerStat; acs: number; kills: number; adr: number } | null = null;
  for (const value of totals.values()) {
    if (!best) {
      best = value;
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
  return best?.stat ?? null;
}

function formatOrdinal(index: number): string {
  if (index === 1) return '1st';
  if (index === 2) return '2nd';
  if (index === 3) return '3rd';
  return `${index}th`;
}

export function buildResultEmbed(details: MatchDetails, matchUrl: string): EmbedBuilder {
  const winnerName = getMapWinner({ name: 'Final', score: `${details.score1}-${details.score2}`, team1Stats: [], team2Stats: [] }, details.team1, details.team2);
  const overallMvp = findOverallMVP(details);
  const overallMvpText = overallMvp ? `${overallMvp.name} (${parseStatNumber(overallMvp.acs).toFixed(2)} Rating)` : 'N/A';
  const embedColor = winnerName === details.team1 ? VLR_GREEN : winnerName === details.team2 ? VLR_RED : VLR_GREY;

  const mapLines = details.maps
    .map((m: MapResult, index) => {
      const winner = getMapWinner(m, details.team1, details.team2);
      return `**${formatOrdinal(index + 1)} ${m.name}** — ${winner}`;
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
  const header = '`Player         | Rating | ACS  | K/D/A   | HS%`';
  const rows = players.map((p) => {
    const name = p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name.padEnd(12);
    const rating = parseStatNumber(p.acs).toFixed(2).padStart(5);
    const acs = parseStatNumber(p.acs).toFixed(2).padStart(5);
    const kda = `${p.kills}/${p.deaths}/${p.assists}`.padEnd(7);
    const hs = p.hsPercent.replace(/[^\d\.]/g, '').padStart(3);
    return `\`${name} | ${rating} | ${acs} | ${kda} | ${hs}%\``;
  });
  return [header, ...rows].join('\n');
}

export function buildMapStatsEmbeds(details: MatchDetails): EmbedBuilder[] {
  return details.maps.map((map: MapResult) => {
    const winner = getMapWinner(map, details.team1, details.team2);
    const mapColor = winner === details.team1 ? VLR_GREEN : winner === details.team2 ? VLR_RED : VLR_GREY;
    const team1Label = winner === details.team1 ? `✅ ${details.team1}` : details.team1;
    const team2Label = winner === details.team2 ? `✅ ${details.team2}` : details.team2;
    const mvp = findMapMVP([...map.team1Stats, ...map.team2Stats]);
    const mvpText = mvp ? `${mvp.name} — ${parseStatNumber(mvp.acs).toFixed(2)} Rating` : 'N/A';

    return new EmbedBuilder()
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
      );
  });
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
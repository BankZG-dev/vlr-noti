import cron from 'node-cron';
import { TextChannel, ThreadAutoArchiveDuration } from 'discord.js';
import { getUpcomingMatches, getMatchDetails } from '../scraper/vlr';
import { prisma } from '../db';
import { TrackedMatch } from '@prisma/client';
import { client } from '../index';
import {
  buildLiveEmbed,
  buildResultEmbed,
  buildMapStatsEmbeds,
  buildUpcomingWarningEmbedWithTwitch,
  buildMapUpdateEmbed,
  TwitchLinks,
} from '../../utils/embeds';
import { findRole } from '../../utils/roleHelper';
import { shouldSend10MinWarning, fetchTwitchLinks, getTimeRemaining } from '../../utils/matchHelper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a stable ID from a VLR match URL, e.g. "12345" from "/666491/..." */
function matchIdFromUrl(url: string): string {
  const parts = url.replace('https://www.vlr.gg/', '').split('/').filter(Boolean);
  return parts[0] ?? encodeURIComponent(url);
}

/**
 * Collect all Discord role mentions relevant to a match across a guild
 * WITH deduplication: if a user subscribed to both a team AND a player on that team,
 * only send one notification
 */
async function getRoleMentions(
  guildId: string,
  team1: string,
  team2: string,
  event: string,
  matchUrl: string
): Promise<string[]> {
  const teamSubs = await prisma.userSubscription.findMany({
    where: {
      guildId,
      type: 'team',
      name: { in: [team1.toLowerCase(), team2.toLowerCase()] },
    },
  });

  // Broader subscriptions (region and tournament)
  const broadSubs = await prisma.userSubscription.findMany({
    where: { guildId, type: { in: ['region', 'tournament'] } },
  });

  const relevantBroad = broadSubs.filter((s) =>
    event.toLowerCase().includes(s.name.toLowerCase())
  );

  // Player subscriptions require match detail lookup
  let playerSubs: typeof teamSubs = [];
  const details = await getMatchDetails(matchUrl).catch(() => null);
  
  if (details) {
    const allPlayerSubs = await prisma.userSubscription.findMany({
      where: { guildId, type: 'player' },
    });

    const allPlayers = details.maps
      .flatMap((map) => [
        ...map.team1Stats.map((p) => p.name.toLowerCase()),
        ...map.team2Stats.map((p) => p.name.toLowerCase()),
      ]);

    playerSubs = allPlayerSubs.filter((sub) =>
      allPlayers.includes(sub.name.toLowerCase())
    );
  }

  const allSubs = [...teamSubs, ...relevantBroad, ...playerSubs];
  if (allSubs.length === 0) return [];

  // DEDUPLICATION: Group subscriptions by user+type, then fetch roles
  // This prevents duplicate pings if a user subscribed to the same match via multiple paths
  const subsMap = new Map<string, typeof allSubs[0]>();
  for (const sub of allSubs) {
    const key = `${sub.userId}:${sub.type}:${sub.name}`;
    // Keep the first (doesn't matter which since same user+type+name)
    if (!subsMap.has(key)) {
      subsMap.has(key) === false && subsMap.set(key, sub);
    }
  }

  const mentions: string[] = [];
  const seen = new Set<string>();

  for (const sub of subsMap.values()) {
    const roleKey = `${sub.guildId}:${sub.type}:${sub.name}`;
    if (seen.has(roleKey)) continue;
    seen.add(roleKey);

    const record = await (prisma as any).managedRole.findUnique({
      where: { guildId_type_name: { guildId, type: sub.type, name: sub.name } },
    });
    if (record) mentions.push(`<@&${record.roleId}>`);
  }

  return mentions;
}

/** Send a message + optional thread to all guilds that have relevant subscribers */
async function notifyAllGuilds(
  matchId: string,
  team1: string,
  team2: string,
  event: string,
  matchUrl: string,
  buildMessage: (mentions: string[]) => {
    content: string;
    embeds: any[];
    threadEmbeds?: any[];
    threadName?: string;
  }
) {
  // Get every guild that has a subscription relevant to this match
  const guilds = await prisma.guild.findMany();

  for (const guildConfig of guilds) {
    if (!guildConfig.announcementChannelId) continue;

    const mentions = await getRoleMentions(guildConfig.id, team1, team2, event, matchUrl);
    if (mentions.length === 0) continue;

    const discordGuild = client.guilds.cache.get(guildConfig.id);
    if (!discordGuild) continue;

    const channel = discordGuild.channels.cache.get(
      guildConfig.announcementChannelId
    ) as TextChannel | undefined;
    if (!channel) continue;

    const msg = buildMessage(mentions);
    const sent = await channel.send({
      content: msg.content,
      embeds: msg.embeds,
    });

    // If there are per-map stats, post them in a thread
    if (msg.threadEmbeds && msg.threadEmbeds.length > 0 && msg.threadName) {
      try {
        const thread = await sent.startThread({
          name: msg.threadName.substring(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
          reason: 'VLR match stats',
        });
        for (const embed of msg.threadEmbeds) {
          await thread.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('[polling] Failed to create stats thread:', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main polling function
// ---------------------------------------------------------------------------

async function poll() {
  const matches = await getUpcomingMatches();

  for (const match of matches) {
    const matchId = matchIdFromUrl(match.url);
    const isLive = match.status.toUpperCase() === 'LIVE';

    // ── Upsert the match into TrackedMatch ──────────────────────────────────
    const tracked = await prisma.trackedMatch.upsert({
      where: { id: matchId },
      update: {
        team1: match.team1,
        team2: match.team2,
        event: match.event,
        matchUrl: match.url,
        status: isLive ? 'live' : 'upcoming',
        updatedAt: new Date(),
      },
      create: {
        id: matchId,
        team1: match.team1,
        team2: match.team2,
        event: match.event,
        matchUrl: match.url,
        status: isLive ? 'live' : 'upcoming',
        startTime: new Date(),
      },
    });

    // ── 10-minute warning with Twitch links ─────────────────────────────────
    if (!tracked.notifiedWarning && !isLive && shouldSend10MinWarning(match.time || match.status)) {
      // Fetch Twitch links
      const twitchLinks = await fetchTwitchLinks(match.team1, match.team2, match.event);

      await prisma.trackedMatch.update({
        where: { id: matchId },
        data: {
          notifiedWarning: true,
          twitchLinks: JSON.stringify(twitchLinks),
        },
      });

      await notifyAllGuilds(
        matchId,
        match.team1,
        match.team2,
        match.event,
        match.url,
        (mentions) => ({
          content: mentions.join(' '),
          embeds: [buildUpcomingWarningEmbedWithTwitch(match, twitchLinks)],
        })
      );
      console.log(`[polling] Sent 10-minute warning for ${match.team1} vs ${match.team2}`);
    }

    // ── LIVE notification ───────────────────────────────────────────────────
    if (isLive && !tracked.notifiedLive) {
      await prisma.trackedMatch.update({
        where: { id: matchId },
        data: { status: 'live', notifiedLive: true, lastMapUpdateTime: new Date() },
      });

      await notifyAllGuilds(
        matchId,
        match.team1,
        match.team2,
        match.event,
        match.url,
        (mentions) => ({
          content: mentions.join(' '),
          embeds: [buildLiveEmbed(match)],
        })
      );
      console.log(`[polling] Sent LIVE notification for ${match.team1} vs ${match.team2}`);
    }

    // ── LIVE map updates (every 2 minutes, but throttle to every 5+ min per match) ──
    if (isLive && tracked.status === 'live') {
      const lastUpdate = tracked.lastMapUpdateTime ? new Date(tracked.lastMapUpdateTime) : new Date(0);
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

      if (timeSinceUpdate >= THROTTLE_MS) {
        try {
          const details = await getMatchDetails(match.url);
          if (details && details.maps.length > 0) {
            // Build current scores
            const currentScores = details.maps.map((map, idx) => ({
              mapNum: idx + 1,
              team1Score: map.team1Score,
              team2Score: map.team2Score,
            }));

            // Get last known scores from database
            let lastScores: typeof currentScores = [];
            if (tracked.lastMapScores) {
              try {
                lastScores = JSON.parse(tracked.lastMapScores);
              } catch (err) {
                console.warn('[polling] Failed to parse lastMapScores:', err);
              }
            }

            // Check if scores have changed
            const scoresChanged =
              lastScores.length !== currentScores.length ||
              lastScores.some((last, idx) => {
                const current = currentScores[idx];
                return last.team1Score !== current.team1Score || last.team2Score !== current.team2Score;
              });

            // Only send update if scores changed AND throttle time passed
            if (scoresChanged) {
              await prisma.trackedMatch.update({
                where: { id: matchId },
                data: {
                  lastMapUpdateTime: new Date(),
                  lastMapScores: JSON.stringify(currentScores),
                },
              });

              await notifyAllGuilds(
                matchId,
                match.team1,
                match.team2,
                match.event,
                match.url,
                (mentions) => ({
                  content: mentions.join(' '),
                  embeds: [buildMapUpdateEmbed(details.team1, details.team2, details.maps)],
                })
              );
              console.log(`[polling] Sent map update for ${match.team1} vs ${match.team2}`);
            }
          }
        } catch (err) {
          console.error(`[polling] Error fetching live updates for ${match.url}:`, err);
        }
      }
    }
  }

  // ── FINAL notification ────────────────────────────────────────────────────
  // Matches that were LIVE but are no longer in the upcoming list are finished.
  const liveTracked = await prisma.trackedMatch.findMany({
    where: { status: 'live', notifiedFinal: false },
  });

  const liveUrls = new Set(
    matches.filter((m) => m.status.toUpperCase() === 'LIVE').map((m) => m.url)
  );

  for (const tracked of liveTracked) {
    if (!liveUrls.has(tracked.matchUrl)) {
      // Match has ended — scrape the final details
      try {
        const details = await getMatchDetails(tracked.matchUrl);

        await prisma.trackedMatch.update({
          where: { id: tracked.id },
          data: { status: 'final', notifiedFinal: true },
        });

        if (!details) continue;

        const mapStatsEmbeds = buildMapStatsEmbeds(details);
        const threadName = `${details.team1} ${details.score1}–${details.score2} ${details.team2} — Map Stats`;

        await notifyAllGuilds(
          tracked.id,
          tracked.team1,
          tracked.team2,
          tracked.event,
          tracked.matchUrl,
          (mentions) => ({
            content: mentions.join(' '),
            embeds: [buildResultEmbed(details, tracked.matchUrl)],
            threadEmbeds: mapStatsEmbeds,
            threadName,
          })
        );
        console.log(`[polling] Sent FINAL result for ${tracked.team1} vs ${tracked.team2}`);
      } catch (err) {
        console.error(`[polling] Error processing final match ${tracked.matchUrl}:`, err);
      }
    }
  }

  // ── PERSISTENCE: Check for matches that were supposed to notify but bot was offline
  // These are matches that are no longer LIVE but notifiedFinal is still false
  const missedFinal = await prisma.trackedMatch.findMany({
    where: {
      status: { not: 'upcoming' },
      notifiedFinal: false,
      notifiedLive: true,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
  });

  for (const tracked of missedFinal) {
    try {
      console.log(`[polling] Checking missed match ${tracked.team1} vs ${tracked.team2}`);
      const details = await getMatchDetails(tracked.matchUrl);

      if (!details) continue;

      await prisma.trackedMatch.update({
        where: { id: tracked.id },
        data: { status: 'final', notifiedFinal: true },
      });

      const mapStatsEmbeds = buildMapStatsEmbeds(details);
      const threadName = `${details.team1} ${details.score1}–${details.score2} ${details.team2} — Map Stats (Backfill)`;

      await notifyAllGuilds(
        tracked.id,
        tracked.team1,
        tracked.team2,
        tracked.event,
        tracked.matchUrl,
        (mentions) => ({
          content: mentions.length > 0 ? `⚠️ **Match Result (Posted Late)** ${mentions.join(' ')}` : '⚠️ **Match Result (Posted Late)**',
          embeds: [buildResultEmbed(details, tracked.matchUrl)],
          threadEmbeds: mapStatsEmbeds,
          threadName,
        })
      );
      console.log(`[polling] Sent BACKFILL result for ${tracked.team1} vs ${tracked.team2}`);
    } catch (err) {
      console.error(`[polling] Error in persistence check for ${tracked.matchUrl}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function startPolling() {
  console.log('[polling] Started background polling for live matches...');
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      await poll();
    } catch (err) {
      console.error('[polling] Unhandled error in poll():', err);
    }
  });
}
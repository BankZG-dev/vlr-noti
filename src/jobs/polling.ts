import cron from 'node-cron';
import { TextChannel, ThreadAutoArchiveDuration } from 'discord.js';
import { getUpcomingMatches, getMatchDetails } from '../scraper/vlr';
import { prisma } from '../db';
import { TrackedMatch } from '@prisma/client';
import { client } from '../index';
import { buildLiveEmbed, buildResultEmbed, buildMapStatsEmbeds, buildUpcomingWarningEmbed } from '../../utils/embeds';
import { findRole } from '../../utils/roleHelper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a stable ID from a VLR match URL, e.g. "12345" from "/matches/12345/team-a-vs-team-b" */
function matchIdFromUrl(url: string): string {
  const parts = url.replace('https://www.vlr.gg/', '').split('/').filter(Boolean);
  return parts[1] ?? parts[0] ?? encodeURIComponent(url);
}

/** Collect all Discord role mentions relevant to a match across a guild */
async function getRoleMentions(
  guildId: string,
  team1: string,
  team2: string,
  event: string,
  matchUrl: string
): Promise<string[]> {
  // Look up all subscriptions that match team names, region, or tournament
  const subs = await prisma.userSubscription.findMany({
    where: {
      guildId,
      OR: [
        { type: 'team', name: team1.toLowerCase() },
        { type: 'team', name: team2.toLowerCase() },
        // Region and tournament subscriptions are broader — we match by
        // checking if the event string contains the subscription name
      ],
    },
  });

  // Also fetch region + tournament subs and filter in memory
  const broadSubs = await prisma.userSubscription.findMany({
    where: { guildId, type: { in: ['region', 'tournament'] } },
  });

  const relevantBroad = broadSubs.filter((s) =>
    event.toLowerCase().includes(s.name.toLowerCase())
  );

  // Player subscriptions require match detail lookup
  const playerSubs = await prisma.userSubscription.findMany({
    where: { guildId, type: 'player' },
  });

  const playerMatches: typeof playerSubs = [];
  if (playerSubs.length > 0) {
    const details = await getMatchDetails(matchUrl);
    if (details) {
      const players = details.maps.flatMap((map) => [
        ...map.team1Stats.map((p) => p.name.toLowerCase()),
        ...map.team2Stats.map((p) => p.name.toLowerCase()),
      ]);
      for (const sub of playerSubs) {
        if (players.includes(sub.name.toLowerCase())) {
          playerMatches.push(sub);
        }
      }
    }
  }

  const allSubs = [...subs, ...relevantBroad, ...playerMatches];
  if (allSubs.length === 0) return [];

  // Deduplicate type+name combos and fetch Discord role IDs
  const seen = new Set<string>();
  const mentions: string[] = [];

  for (const sub of allSubs) {
    const key = `${sub.type}:${sub.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

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
    const tracked: any = await prisma.trackedMatch.upsert({
      where: { id: matchId },
      update: {
        team1: match.team1,
        team2: match.team2,
        event: match.event,
        matchUrl: match.url,
        status: isLive ? 'live' : 'upcoming',
        startTime: new Date(),
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

    // ── 10-minute warning ───────────────────────────────────────────────────
    // VLR shows match time as e.g. "10:00 PM" — we check if it's ~10 min away
    // We do a simple approach: if status contains a time string and we haven't
    // notified yet, check if it's within 10 min of now.
    // (Full implementation would parse the time; this is a best-effort check.)
    if (!tracked.notifiedLive && !isLive) {
      const timeStr = match.time || match.status;
      if (timeStr && timeStr.match(/\d{1,2}:\d{2}/)) {
        const now = new Date();
        // Parse the time (VLR times are in the server's local timezone — approximate)
        const [hourMin, ampm] = timeStr.split(' ');
        if (hourMin && ampm) {
          let [h, m] = hourMin.split(':').map(Number);
          if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
          if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
          const matchTime = new Date();
          matchTime.setHours(h, m, 0, 0);
          const diffMs = matchTime.getTime() - now.getTime();
          const diffMin = diffMs / 60000;

                  if (diffMin > 0 && diffMin <= 12) {
            // Send 10-min warning
            await notifyAllGuilds(
              matchId,
              match.team1,
              match.team2,
              match.event,
              match.url,
              (mentions) => ({
                content: mentions.join(' '),
                embeds: [buildUpcomingWarningEmbed(match)],
              })
            );
          }
        }
      }
    }

    // ── LIVE notification ───────────────────────────────────────────────────
    if (isLive && !tracked.notifiedLive) {
      await prisma.trackedMatch.update({
        where: { id: matchId },
        data: { status: 'live', notifiedLive: true },
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
    if (!liveUrls.has((tracked as any).matchUrl)) {
      // Match has ended — scrape the final details
      const details = await getMatchDetails((tracked as any).matchUrl);

      await prisma.trackedMatch.update({
        where: { id: tracked.id },
        data: { status: 'final', notifiedFinal: true },
      });

      if (!details) continue;

      const mapStatsEmbeds = buildMapStatsEmbeds(details);
      const threadName = `${details.team1} ${details.score1}–${details.score2} ${details.team2} — Map Stats`;

      await notifyAllGuilds(
        tracked.id,
        (tracked as any).team1,
        (tracked as any).team2,
        (tracked as any).event,
        (tracked as any).matchUrl,
        (mentions) => ({
          content: mentions.join(' '),
          embeds: [buildResultEmbed(details, (tracked as any).matchUrl)],
          threadEmbeds: mapStatsEmbeds,
          threadName,
        })
      );
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
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import * as dotenv from 'dotenv';
import { prisma } from './db';

dotenv.config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

const SUBSCRIBE_TYPES = ['team', 'player', 'region', 'tournament'] as const;

const commands = [
  // ── Subscribe ─────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to get match notifications')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('What to subscribe to')
        .setRequired(true)
        .addChoices(
          { name: 'Team', value: 'team' },
          { name: 'Player', value: 'player' },
          { name: 'Region', value: 'region' },
          { name: 'Tournament', value: 'tournament' }
        )
    )
    .addStringOption((o) =>
      o.setName('name').setDescription('Exact name (e.g. Sentinels / TenZ / NA / VCT Champions)').setRequired(true)
    ),

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe from match notifications')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('What to unsubscribe from')
        .setRequired(true)
        .addChoices(
          { name: 'Team', value: 'team' },
          { name: 'Player', value: 'player' },
          { name: 'Region', value: 'region' },
          { name: 'Tournament', value: 'tournament' }
        )
    )
    .addStringOption((o) =>
      o.setName('name').setDescription('Name you subscribed with').setRequired(true)
    ),

  // ── Subscriptions ─────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('View your current subscriptions'),

  // ── Set channel ───────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel for bot announcements')
    .addChannelOption((o) =>
      o.setName('channel').setDescription('The channel to send updates to').setRequired(true)
    ),

  // ── Results ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('results')
    .setDescription('Get recent match results for a team')
    .addStringOption((o) =>
      o.setName('team').setDescription('Team name to search for').setRequired(true)
    ),

  // ── Upcoming ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('View upcoming matches for a team')
    .addStringOption((o) =>
      o.setName('team').setDescription('Team name to search for').setRequired(true)
    ),

  // ── Tournament ────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('View group stage and playoff matches for a tournament')
    .addStringOption((o) =>
      o.setName('name').setDescription('Tournament name (e.g. VCT Champions 2025)').setRequired(true)
    ),

  // ── Help ──────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available bot commands'),
].map((c) => c.toJSON());

// ---------------------------------------------------------------------------
// Bot ready
// ---------------------------------------------------------------------------

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');

    try {
      await prisma.$connect();
      console.log('[db] connected to database');
    } catch (err) {
      console.error('[db] failed to connect to database:', err);
      process.exit(1);
    }

    const { startPolling } = await import('./jobs/polling');
    startPolling();
  } catch (error) {
    console.error(error);
  }
});

// ---------------------------------------------------------------------------
// Interaction handler
// ---------------------------------------------------------------------------

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // ── /setchannel ────────────────────────────────────────────────────────────
  if (commandName === 'setchannel') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const channelId = interaction.options.getChannel('channel')?.id;
    if (!channelId || !interaction.guildId) {
      return interaction.editReply('Failed to set channel.');
    }
    await prisma.guild.upsert({
      where: { id: interaction.guildId },
      update: { announcementChannelId: channelId },
      create: { id: interaction.guildId, announcementChannelId: channelId },
    });
    return interaction.editReply(`✅ Announcement channel set to <#${channelId}>`);
  }

  // ── /subscribe ─────────────────────────────────────────────────────────────
  if (commandName === 'subscribe') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const type = interaction.options.getString('type', true);
    const rawName = interaction.options.getString('name', true);
    const normalized = rawName.toLowerCase();

    if (!interaction.guildId || !interaction.guild) {
      return interaction.editReply('This command must be used in a server.');
    }

    try {
      // 1. Create subscription in DB
      await prisma.userSubscription.create({
        data: {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          type,
          name: normalized,
        },
      });

      // 2. Get or create the Discord role
      const { getOrCreateRole } = await import('../utils/roleHelper');
      const role = await getOrCreateRole(interaction.guild, type, rawName);

      // 3. Assign role to user
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);

      return interaction.editReply(
        `✅ Subscribed to **${rawName}** (${type})!\nYou've been given the ${role} role and will be pinged for their matches.`
      );
    } catch (err: any) {
      if (err.code === 'P2002') {
        return interaction.editReply(`You are already subscribed to **${rawName}**.`);
      }
      if (err.code === 'ETIMEDOUT') {
        console.error('[prisma] timeout while creating subscription', err);
        return interaction.editReply('Database timeout occurred. Check your DATABASE_URL and database availability.');
      }
      console.error(err);
      return interaction.editReply('An error occurred while subscribing.');
    }
  }

  // ── /unsubscribe ───────────────────────────────────────────────────────────
  if (commandName === 'unsubscribe') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const type = interaction.options.getString('type', true);
    const rawName = interaction.options.getString('name', true);
    const normalized = rawName.toLowerCase();

    if (!interaction.guildId || !interaction.guild) {
      return interaction.editReply('This command must be used in a server.');
    }

    try {
      await prisma.userSubscription.deleteMany({
        where: {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          type,
          name: normalized,
        },
      });

      // Remove the role from the user
      const { findRole } = await import('../utils/roleHelper');
      const role = await findRole(interaction.guild, type, normalized);
      if (role) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.remove(role);
      }

      return interaction.editReply(`❌ Unsubscribed from **${rawName}** (${type}).`);
    } catch (err) {
      console.error(err);
      return interaction.editReply('An error occurred while unsubscribing.');
    }
  }

  // ── /subscriptions ─────────────────────────────────────────────────────────
  if (commandName === 'subscriptions') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const subs = await prisma.userSubscription.findMany({
      where: { userId: interaction.user.id, guildId: interaction.guildId! },
    });
    if (subs.length === 0) {
      return interaction.editReply('You have no active subscriptions.');
    }
    const lines = subs.map((s) => `• **${s.name}** (${s.type})`).join('\n');
    return interaction.editReply(`**Your subscriptions:**\n${lines}`);
  }

  // ── /results ───────────────────────────────────────────────────────────────
  if (commandName === 'results') {
    await interaction.deferReply();
    const team = interaction.options.getString('team', true);
    const { getRecentResults, getMatchDetails } = await import('./scraper/vlr');
    const { buildResultEmbed, buildMapStatsEmbeds } = await import('../utils/embeds');

    const results = await getRecentResults(team);
    if (results.length === 0) {
      return interaction.editReply(`No recent matches found for **${team}**.`);
    }

    const menuOptions = results.slice(0, 25).map((m) => ({
      label: `${m.team1} vs ${m.team2}`.substring(0, 100),
      description: `${m.event} | ${m.score1 ?? '?'} – ${m.score2 ?? '?'}`.substring(0, 100),
      value: m.url.substring(0, 100),
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId('results-select')
      .setPlaceholder('Select a match to view details')
      .addOptions(menuOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    const response = await interaction.editReply({
      content: `Found **${results.length}** recent matches for **${team}**. Select one:`,
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "These aren't your results!", ephemeral: true });
      }
      await i.deferUpdate();
      const details = await getMatchDetails(i.values[0]);
      if (!details) {
        return i.editReply({ content: 'Failed to fetch match details.', components: [] });
      }

      const resultEmbed = buildResultEmbed(details, i.values[0]);
      const mapEmbeds = buildMapStatsEmbeds(details);

      // Show result embed + first map inline; rest in follow-up
      await i.editReply({ content: '', embeds: [resultEmbed], components: [] });
      for (const mapEmbed of mapEmbeds) {
        await interaction.followUp({ embeds: [mapEmbed], ephemeral: false });
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Timed out.', components: [] }).catch(() => {});
      }
    });
  }

  // ── /upcoming ──────────────────────────────────────────────────────────────
  if (commandName === 'upcoming') {
    await interaction.deferReply();
    const team = interaction.options.getString('team', true);
    const { getTeamUpcoming } = await import('./scraper/vlr');
    const { buildUpcomingEmbed } = await import('../utils/embeds');

    const matches = await getTeamUpcoming(team);
    const embed = buildUpcomingEmbed(team, matches);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── /tournament ────────────────────────────────────────────────────────────
  if (commandName === 'tournament') {
    await interaction.deferReply();
    const name = interaction.options.getString('name', true);
    const { getTournamentMatches } = await import('./scraper/vlr');
    const { buildTournamentEmbeds } = await import('../utils/embeds');

    const stages = await getTournamentMatches(name);
    if (stages.length === 0) {
      return interaction.editReply(`No tournament found for **${name}**. Try a more specific name.`);
    }

    const embeds = buildTournamentEmbeds(name, stages);
    // Discord allows max 10 embeds per message — send first batch then follow up
    const first = embeds.slice(0, 10);
    const rest = embeds.slice(10);
    await interaction.editReply({ embeds: first });
    for (const embed of rest) {
      await interaction.followUp({ embeds: [embed] });
    }
  }

  // ── /help ──────────────────────────────────────────────────────────────────
  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0xff4655)
      .setTitle('Valorant Match Tracker — Commands')
      .addFields(
        {
          name: '📋 Subscriptions',
          value:
            '`/subscribe <type> <name>` — Subscribe to a team, player, region, or tournament\n`/unsubscribe <type> <name>` — Remove a subscription\n`/subscriptions` — View your active subscriptions',
        },
        {
          name: '🔍 Match Info',
          value:
            '`/results <team>` — Recent results with per-map player stats\n`/upcoming <team>` — Upcoming scheduled matches for a team',
        },
        {
          name: '🏆 Tournament',
          value: '`/tournament <name>` — Group stage + playoff match list',
        },
        {
          name: '⚙️ Setup',
          value: '`/setchannel <channel>` — Set where bot announcements are sent',
        },
        {
          name: '🔔 Notifications',
          value:
            'When subscribed you\'ll receive:\n• ⏰ 10-min warning before a match\n• 🔴 Alert when a match goes live\n• ✅ Full result + per-map stats after the match ends',
        }
      )
      .setFooter({ text: 'vlr.gg tracker bot' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to a team to get live match notifications')
    .addStringOption(option =>
      option.setName('team')
        .setDescription('The exact name of the team (e.g. Sentinels)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe from a team')
    .addStringOption(option =>
      option.setName('team')
        .setDescription('The exact name of the team')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('View your current team subscriptions'),
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel for bot announcements')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send updates to')
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Wait, we need the application ID. We'll extract it using the client.
  } catch (error) {
    console.error(error);
  }
})();

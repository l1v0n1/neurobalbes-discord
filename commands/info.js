import {  SlashCommandBuilder  } from 'discord.js';
import {  answers  } from '../assets/answers.js';
import {  languages  } from '../assets/descriptions.js';
import {  getChat  } from '../src/database/database.js';
import {  getLocale  } from '../src/utils/functions.js';

// Attempt to load prefix, handle if config.json is missing
let prefix = '?'; // Default prefix if config is missing
try {
  const configModule = await import('../config.json', { with: { type: 'json' } });
  prefix  = configModule.default.prefix || prefix;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    console.error("Error loading prefix from config.json:", error);
  }
  console.warn("config.json not found or missing prefix, using default prefix '"+prefix+"'");
}

export default {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription(languages.info.main['en-US'])
    .setDescriptionLocalizations(languages.info.main),
  ephemeral: true,
  async execute(interaction) {
    if (!interaction.guildId) {
      try {
        await interaction.reply({ 
          content: "This command can only be used in a server.", 
          flags: { ephemeral: true }
        });
      } catch (replyError) { console.error("Failed to send guild-only reply:", replyError); }
      return;
    }

    let chat;
    let lang = 'en-US';

    try {
      // The deferReply is now handled in bot.js

      try {
        chat = await getChat(interaction.guildId);
        lang = chat?.lang === 'en' ? 'en-US' : (chat?.lang || 'en-US');
      } catch (dbError) {
        console.error(`Database error fetching chat for info command in guild ${interaction.guildId}:`, dbError);
        await interaction.editReply({ content: getLocale(answers, 'common', 'database_error', lang) || "Database error occurred." });
        return;
      }

      // Safely access chat properties with defaults
      const talk = chat?.talk ?? 1; // Default to talk = 1 (active) if undefined
      const gen = chat?.gen ?? 0; // Default to gen = 0 (default) if undefined
      const speed = chat?.speed ?? 50; // Default to speed = 50 if undefined
      const textbaseLength = Array.isArray(chat?.textbase) ? chat.textbase.length : 0;

      // Build description parts, using getLocale with fallbacks
      const serverIDText = getLocale(answers, 'info', 'serverID', lang, interaction.guildId) || `Server ID: ${interaction.guildId}`;
      const savedCountText = getLocale(answers, 'info', 'saved_count', lang, textbaseLength) || `Saved Messages: ${textbaseLength}`;

      let statusText;
      if (talk === 0) { // Bot is silent
        statusText = getLocale(answers, 'info', 'bot_silent', lang, prefix) || `Bot is silent (requires prefix: ${prefix})`;
      } else { // Bot is active
        const speedValueText = getLocale(answers, 'info', 'speed', lang, speed) || `Speed: ${speed}`;
        const generationMode = gen === 1 ? (getLocale(answers, 'info', 'literate', lang) || 'Literate') : (getLocale(answers, 'info', 'default', lang) || 'Default');
        const modeValueText = getLocale(answers, 'info', 'mode', lang, generationMode) || `Mode: ${generationMode}`;
        statusText = `${modeValueText}\n${speedValueText}`;
      }

      const message = `${serverIDText}\n${savedCountText}\n\n${statusText}`.trim();

      await interaction.editReply(message);

    } catch (error) {
      console.error(`Error executing info command for guild ${interaction.guildId}:`, error);
      // Avoid editing reply if initial defer failed
      if (!interaction.replied && !interaction.deferred) {
        try { await interaction.reply({ content: 'An error occurred while retrieving info.', flags: { ephemeral: true } }); } catch {}
      } else if (!interaction.ephemeral) { // Check if interaction is ephemeral before editing non-ephemerally
        try { await interaction.editReply({ content: 'An error occurred while retrieving info.' }); } catch {}
      }
    }
  }
};

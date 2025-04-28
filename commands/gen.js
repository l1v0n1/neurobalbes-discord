import {  SlashCommandBuilder, EmbedBuilder, MessageFlags  } from 'discord.js';
import {  getChat  } from '../src/database/database.js';
import Markov from '../src/utils/markov.js';
import {  getLocaleWithoutString, getLocale, randomInteger  } from '../src/utils/functions.js';
import {  languages  } from '../assets/descriptions.js';
import {  answers  } from '../assets/answers.js';

// Constants for generation parameters
const LONG_TEXT_LENGTH = 400;
const BUGURT_MIN_LINES = 2;
const BUGURT_MAX_LINES = 8;
const DIALOGUE_MIN_LINES = 3;
const DIALOGUE_MAX_LINES = 4;
const POEM_MIN_LINES = 4;
const POEM_MAX_LINES = 16;
const QUOTE_LENGTH = 50;
const MAX_REPLY_LENGTH = 2000;

// Helper function to safely generate text
function safeGenerate(chain, method, ...args) {
    try {
        const result = chain[method](...args);
        // Basic check for empty or invalid result
        return (typeof result === 'string' && result.trim().length > 0) ? result : null;
    } catch (genError) {
        console.error(`Markov generation error (${method}):`, genError);
        return null;
    }
}

export default {
  data: new SlashCommandBuilder()
    .setName('gen')
    .setDescription(languages.gen.main['en-US'])
    .setDescriptionLocalizations(languages.gen.main)
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription(languages.gen.type['en-US'])
        .setDescriptionLocalizations(languages.gen.type)
        .setRequired(true)
        .addChoices(
          { name: languages.gen.default['en-US'], value: 'default', name_localizations: languages.gen.default },
          { name: languages.gen.literate['en-US'], value: 'syntax', name_localizations: languages.gen.literate },
          { name: languages.gen.longtext['en-US'], value: 'long', name_localizations: languages.gen.longtext },
          { name: languages.gen.joke['en-US'], value: 'joke', name_localizations: languages.gen.joke },
          { name: languages.gen.buhurt['en-US'], value: 'bugurt', name_localizations: languages.gen.buhurt },
          { name: languages.gen.dialog['en-US'], value: 'dialogue', name_localizations: languages.gen.dialog },
          { name: languages.gen.verse['en-US'], value: 'poem', name_localizations: languages.gen.verse },
          { name: languages.gen.quote['en-US'], value: 'quote', name_localizations: languages.gen.quote }
        )
    )
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    }

    const type = interaction.options.getString('type'); // Use getString for clarity
    let chat;
    let lang = 'en-US'; // Default language

    try {
      chat = await getChat(interaction.guildId);
      lang = chat?.lang || 'en-US'; // Set language after fetching chat
    } catch (dbError) {
      console.error(`Database error fetching chat for guild ${interaction.guildId}:`, dbError);
      await interaction.editReply({ content: getLocale(answers, 'common', 'database_error', lang) });
      return;
    }

    const textBase = chat?.textbase;
    if (!Array.isArray(textBase) || textBase.length < 1) {
      return await interaction.editReply({ content: getLocale(answers, 'gen', 'not_enough_data', lang) });
    }

    let chain;
    try {
      // Ensure elements are strings before joining
      const validTextBase = textBase.filter(item => typeof item === 'string').join(' ');
      if (validTextBase.trim().length === 0) {
        return await interaction.editReply({ content: getLocale(answers, 'gen', 'not_enough_data', lang) });
      }
      chain = new Markov(validTextBase);
    } catch (initError) {
      console.error(`Markov initialization error for guild ${interaction.guildId}:`, initError);
      await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
      return;
    }

    let reply = null;
    let success = true;

    try {
      switch (type) {
        case 'default':
          reply = safeGenerate(chain, 'generate_low');
          break;
        case 'syntax':
          reply = safeGenerate(chain, 'generate_high');
          break;
        case 'long':
          reply = safeGenerate(chain, 'generate_low', LONG_TEXT_LENGTH);
          break;
        case 'joke': {
          const generated_text = safeGenerate(chain, 'generate_low');
          if (generated_text) {
            const jokes = getLocale(answers, 'gen', 'jokes', lang);
            // Ensure jokes is an array before choosing
            reply = Array.isArray(jokes) ? jokes[Math.floor(Math.random() * jokes.length)].replace('%VAR%', generated_text) : generated_text;
          } else {
            success = false;
          }
          break;
        }
        case 'bugurt': {
          const numLines = randomInteger(BUGURT_MIN_LINES, BUGURT_MAX_LINES);
          const lines = [];
          for (let i = 0; i < numLines; i++) {
            const line = safeGenerate(chain, 'generate_low');
            if (line) lines.push(line);
            else { success = false; break; } // Stop if generation fails
          }
          if (success && lines.length > 0) reply = lines.join('\n@\n');
          else success = false;
          break;
        }
        case 'dialogue': {
          const numLines = randomInteger(DIALOGUE_MIN_LINES, DIALOGUE_MAX_LINES);
          const lines = [];
          for (let i = 0; i < numLines; i++) {
            const line = safeGenerate(chain, 'generate_low');
            if (line) lines.push(line);
            else { success = false; break; }
          }
          if (success && lines.length > 0) reply = '— ' + lines.join('\n— '); // Add initial dash
          else success = false;
          break;
        }
        case 'poem': {
          const numLines = randomInteger(POEM_MIN_LINES, POEM_MAX_LINES);
          const poem = [];
          const title = getLocale(answers, 'gen', 'poem', lang);
          if (title) poem.push(`\`${title}\`\n`);

          for (let i = 0; i < numLines; i++) {
            const line = safeGenerate(chain, 'generate_high');
            if (line) poem.push(line);
            else { success = false; break; }
          }
          if (success && poem.length > (title ? 1 : 0)) reply = poem.join('\n');
          else success = false;
          break;
        }
        case 'quote':
          const quoteText = safeGenerate(chain, 'generate_high', QUOTE_LENGTH);
          if (quoteText) {
            reply = `«${quoteText}»\n— *<@${interaction.applicationId}>*`;
          } else {
            success = false;
          }
          break;
        default:
          console.warn(`Unknown generation type '${type}' requested by user ${interaction.user.id} in guild ${interaction.guildId}`);
          await interaction.editReply({ content: getLocale(answers, 'common', 'invalid_option', lang) });
          return; // Exit early for unknown type
      }
    } catch (error) {
      console.error(`Unhandled error during generation type ${type} for guild ${interaction.guildId}:`, error);
      success = false;
    }

    if (!success || !reply) {
      // Generic error if generation failed or reply is null/empty
      return await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
    }

    try {
      // Manually truncate reply if it exceeds Discord's limit instead of using Util.splitMessage
      const finalReply = reply.length > MAX_REPLY_LENGTH 
        ? reply.substring(0, MAX_REPLY_LENGTH) 
        : reply;
      await interaction.editReply(finalReply);
    } catch (replyError) {
      console.error(`Failed to send final reply for guild ${interaction.guildId}:`, replyError);
      // Can't edit the reply again if it failed, maybe try followUp?
      try {
        await interaction.followUp({ content: "Failed to send the generated text.", flags: MessageFlags.Ephemeral });
      } catch (followUpError) {
        console.error("Failed to send follow-up error message:", followUpError);
      }
    }
  }
};

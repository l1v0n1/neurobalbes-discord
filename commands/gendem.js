import {  SlashCommandBuilder, AttachmentBuilder  } from 'discord.js';
import {  demotivatorImage  } from '../src/utils/demotivator.js';
import {  getChat  } from '../src/database/database.js';
import Markov  from '../src/utils/markov.js';
import {  languages  } from '../assets/descriptions.js';
import {  getLocale  } from '../src/utils/functions.js';
import {  answers  } from '../assets/answers.js';

// Cooldown management (Note: This is global per user across all guilds)
const userCooldowns = new Map(); // Map<UserId, Timestamp>
const COOLDOWN_TIME_MS = 15000; // 15 seconds

// Generation parameters
const TITLE_MAX_LENGTH = 25;
const TEXT_MAX_LENGTH = 30;

export default {
  data: new SlashCommandBuilder()
    .setName('gendem')
    .setDescription(languages.gendem.main['en-US'])
    .setDescriptionLocalizations(languages.gendem.main)
    .addAttachmentOption((option) => option
      .setRequired(true)
      .setName('image')
      .setDescription(languages.gendem.image['en-US'])
      .setDescriptionLocalizations(languages.gendem.image)),
  async execute(interaction) {
    // --- Initial Checks --- 
    if (!interaction.guildId) {
        try {
            await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
        } catch (replyError) { console.error("Failed to send guild-only reply:", replyError); }
        return;
    }

    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownEnd = userCooldowns.get(userId);

    if (cooldownEnd && now < cooldownEnd) {
        const timeLeft = Math.ceil((cooldownEnd - now) / 1000);
        // Fetch lang here just for the cooldown message if needed, or use a default
        let lang = 'en-US';
        try {
            const chat = await getChat(interaction.guildId); // Minimal fetch just for lang
            lang = chat?.lang || 'en-US';
        } catch { /* Ignore DB error for cooldown message, use default lang */ }

        try {
            await interaction.reply({
                content: getLocale(answers, 'common', 'flood_control', lang, timeLeft),
                ephemeral: true
            });
        } catch (replyError) { console.error("Failed to send cooldown reply:", replyError); }
        return;
    }

    // --- Defer Reply --- 
    try {
        await interaction.deferReply(); // Use deferReply for potentially long operations
    } catch (deferError) {
        console.error("Failed to defer reply:", deferError);
        return; // Can't proceed if defer fails
    }

    // --- Command Logic --- 
    let chat;
    let lang = 'en-US';
    try {
        chat = await getChat(interaction.guildId);
        lang = chat?.lang || 'en-US';

        const attachment = interaction.options.getAttachment('image', true); // Get required attachment

        // Validate attachment type
        if (!attachment.contentType?.startsWith('image/')) {
            return await interaction.editReply({
                content: getLocale(answers, 'gendem', 'not_image', lang), // Assuming key exists
            });
        }

        // Validate textbase
        const textBase = chat?.textbase;
        if (!Array.isArray(textBase) || textBase.length < 1) {
            return await interaction.editReply({ content: getLocale(answers, 'gen', 'not_enough_data', lang) });
        }

        // Initialize Markov Chain
        let chain;
        try {
            const validTextBase = textBase.filter(item => typeof item === 'string').join(' ');
            if (validTextBase.trim().length === 0) {
                return await interaction.editReply({ content: getLocale(answers, 'gen', 'not_enough_data', lang) });
            }
            chain = new Markov(validTextBase);
        } catch (initError) {
            console.error(`Markov initialization error for guild ${interaction.guildId}:`, initError);
            return await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
        }

        // Generate text (using safeGenerate idea from gen.js)
        const title = chain.generate_low(TITLE_MAX_LENGTH); // Assuming generate_low doesn't throw easily
        const text = chain.generate_low(TEXT_MAX_LENGTH);

        if (!title || !text) { // Basic check if generation failed
            console.error(`Markov generation failed for gendem in guild ${interaction.guildId}`);
            return await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
        }

        // Generate Demotivator Image
        let imageBuffer;
        try {
             imageBuffer = await demotivatorImage(attachment.url, title, text); // Pass URL
        } catch (demotivatorError) {
            console.error(`Demotivator generation error for guild ${interaction.guildId}:`, demotivatorError);
            return await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
        }

         if (!imageBuffer) { // Check if demotivator function returned something falsy
             console.error(`Demotivator function returned empty buffer for guild ${interaction.guildId}`);
             return await interaction.editReply({ content: getLocale(answers, 'common', 'processing_error', lang) });
         }

        // --- Success --- 
        // Set cooldown *after* successful execution
        userCooldowns.set(userId, now + COOLDOWN_TIME_MS);
        setTimeout(() => { userCooldowns.delete(userId); }, COOLDOWN_TIME_MS);

        const imageFile = new AttachmentBuilder(imageBuffer, { name: 'demotivator.png' });
        await interaction.editReply({ files: [imageFile] });

    } catch (error) {
        console.error(`Unhandled error in gendem for guild ${interaction.guildId}:`, error);
        try {
            // Attempt to inform user, checking if reply was already sent
            if (!interaction.replied && !interaction.deferred) {
                 await interaction.reply({ content: getLocale(answers, 'common', 'general_error', lang), ephemeral: true });
            } else {
                 await interaction.editReply({ content: getLocale(answers, 'common', 'general_error', lang) });
            }
        } catch (replyError) {
            console.error("Failed to send error reply for gendem:", replyError);
        }
    }
  }
};

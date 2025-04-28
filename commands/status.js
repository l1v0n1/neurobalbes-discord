import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getChat } from '../src/database/database.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';
import logger from '../src/utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show the current settings for the bot'),
        
    // Make visible to everyone
    ephemeral: true,
    
    async execute(interaction) {
        try {
            if (!interaction.guildId) {
                return interaction.reply({ 
                    content: 'This command can only be used in a server.',
                    ephemeral: true 
                });
            }
            
            const guildId = interaction.guildId;
            let lang = 'en'; // Default language
            try {
                 lang = await getServerLanguage(guildId);
            } catch (langError) {
                logger.error(`[status] Error fetching language for guild ${guildId}:`, { error: langError?.message || langError });
                // Proceed with default 'en'
            }
            
            // Get current settings
            const chat = await getChat(guildId);
            if (!chat) {
                 logger.error(`[status] Failed to get chat data for guild ${guildId}.`);
                 return interaction.reply({ content: 'Could not retrieve server settings.', ephemeral: true });
            }
            
            // Get localized strings
            const title = await getLocalizedString(answers, 'status', 'title', lang, interaction.guild.name) 
                || `Bot Status for ${interaction.guild.name}`;
                
            const languageLabel = await getLocalizedString(answers, 'status', 'language_label', lang) 
                || 'Current Language';
                
            const languageName = /* LANGUAGE_NAMES?.[chat.lang || 'en'] || */ 
                                 (await getLocalizedString(answers, 'language', chat.lang || 'en', lang)) || 
                                 chat.lang || 'en'; // Fallback chain
                
            const talkLabel = await getLocalizedString(answers, 'status', 'talk_label', lang) 
                || 'Bot Responses';
                
            const talkStatus = chat.talk === 1 
                ? (await getLocalizedString(answers, 'status', 'talk_enabled', lang) || 'Enabled')
                : (await getLocalizedString(answers, 'status', 'talk_disabled', lang) || 'Disabled');
                
            const speedLabel = await getLocalizedString(answers, 'status', 'speed_label', lang) 
                || 'Response Speed';
                
            const genLabel = await getLocalizedString(answers, 'status', 'gen_label', lang) 
                || 'Generation Mode';
                
            const genMode = chat.gen === 1 
                ? (await getLocalizedString(answers, 'info', 'literate', lang) || 'Literate')
                : (await getLocalizedString(answers, 'info', 'default', lang) || 'Default');
                
            const messagesLabel = await getLocalizedString(answers, 'status', 'messages_label', lang) 
                || 'Stored Messages';
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(title)
                .addFields(
                    { name: languageLabel, value: String(languageName), inline: true },
                    { name: talkLabel, value: String(talkStatus), inline: true },
                    { name: speedLabel, value: String(chat.speed ?? 'N/A'), inline: true },
                    { name: genLabel, value: String(genMode), inline: true },
                    { name: messagesLabel, value: String(chat.textbase?.length ?? '0'), inline: true }
                )
                .setFooter({ text: 'NeuroBalbes' })
                .setTimestamp();
            
            // Check if interaction is still valid before replying
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            } else {
                 return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
        } catch (error) {
            // Log the error originating from THIS command
            logger.error(`[status] Error executing command for guild ${interaction.guildId}:`, {
                 errorMessage: error?.message,
                 errorStack: error?.stack,
                 guildId: interaction.guildId,
                 userId: interaction.user?.id
            });
            console.error('[status command CATCH] Raw caught error:', error); // Log raw error too
            
            // Attempt to reply with a generic error message
            try {
                const errorReply = { 
                    content: 'An error occurred while retrieving status information.',
                    ephemeral: true 
                };
                if (interaction.replied || interaction.deferred) {
                     await interaction.followUp(errorReply).catch(e => {}); // Suppress followUp errors
                } else {
                    await interaction.reply(errorReply).catch(e => {}); // Suppress reply errors
                }
            } catch (replyError) {
                 // Ignore errors during error reporting
            }
            // IMPORTANT: Re-throw the error if you want the central handler in bot.js to also log it
            // throw error; 
            // OR just return here if local logging is sufficient
            return; 
        }
    }
}; 
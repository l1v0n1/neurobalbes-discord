import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getChat } from '../src/database/database.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';
import logger from '../src/utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Shows the bot`s current status and settings for this server.')
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        }

        const lang = await getServerLanguage(interaction.guildId);

        try {
            // Defer reply (ephemeral handled by central handler)
            // await interaction.deferReply({ ephemeral: true }); 

            const chat = await getChat(interaction.guildId);
            if (!chat) {
                logger.warn(`No settings found for guild ${interaction.guildId} in status command.`);
                return interaction.reply({ content: 'Could not retrieve server settings.', flags: MessageFlags.Ephemeral });
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
            
            // Decide whether to edit or reply based on deferral state (should be handled by central handler)
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error executing status command:', { error, guildId: interaction.guildId });
            const errorMessage = await getLocalizedString(answers, 'common', 'general_error', lang);
            // Use flags for ephemeral error reply
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
                }
            } catch (replyError) {
                logger.error('Failed to send error reply for status command:', { replyError });
            }
        }
    },
}; 
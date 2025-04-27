import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getChat } from '../src/database/database.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';

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
            const lang = await getServerLanguage(guildId);
            
            // Get current settings
            const chat = await getChat(guildId);
            
            // Get localized strings
            const title = await getLocalizedString(answers, 'status', 'title', lang, interaction.guild.name) 
                || `Bot Status for ${interaction.guild.name}`;
                
            const languageLabel = await getLocalizedString(answers, 'status', 'language_label', lang) 
                || 'Current Language';
                
            const languageName = await getLocalizedString(answers, 'language', 'translate', lang) 
                || answers.language.translate[lang] || lang;
                
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
                    { name: languageLabel, value: languageName, inline: true },
                    { name: talkLabel, value: talkStatus, inline: true },
                    { name: speedLabel, value: chat.speed.toString(), inline: true },
                    { name: genLabel, value: genMode, inline: true },
                    { name: messagesLabel, value: chat.textbase.length.toString(), inline: true }
                )
                .setFooter({ text: 'NeuroBalbes' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error in status command:', error);
            return interaction.reply({ 
                content: 'An error occurred while retrieving status information.',
                ephemeral: true 
            });
        }
    }
}; 
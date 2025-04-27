import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLanguage } from '../src/database/methods.js';
import { answers } from '../assets/answers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get information about available commands'),
    
    // Explicitly set this to false to handle replies ourselves
    deferReply: false,
    ephemeral: true,
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild?.id;
            const lang = guildId ? await getLanguage(guildId) : 'en';
            
            const helpEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(answers.help.title[lang] || answers.help.title.en)
                .setDescription(answers.help.description[lang] || answers.help.description.en)
                .addFields(
                    { name: '/chat', value: answers.help.chat[lang] || answers.help.chat.en },
                    { name: '/voice', value: answers.help.voice[lang] || answers.help.voice.en },
                    { name: '/language', value: answers.help.language[lang] || answers.help.language.en },
                    { name: '/help', value: answers.help.help[lang] || answers.help.help.en }
                )
                .setFooter({ text: 'NeuroBalbes' });
            
            // Handle both deferred and direct responses
            if (interaction.deferred) {
                return interaction.editReply({
                    embeds: [helpEmbed]
                });
            } else {
                return interaction.reply({
                    embeds: [helpEmbed],
                    flags: { ephemeral: true }
                });
            }
        } catch (error) {
            console.error('Error in help command:', error);
            
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: 'An error occurred while retrieving help information. Please try again later.'
                });
            } else if (!interaction.replied) {
                return interaction.reply({ 
                    content: 'An error occurred while retrieving help information. Please try again later.',
                    flags: { ephemeral: true }
                });
            }
        }
    }
};

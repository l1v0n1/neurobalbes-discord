import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLanguage } from '../src/database/methods.js';
import { answers } from '../assets/answers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get information about available commands')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Display help in a specific language')
                .setRequired(false)
                .addChoices(
                    { name: 'English', value: 'en' },
                    { name: 'Русский', value: 'ru' },
                    { name: 'Українська', value: 'uk' },
                    { name: 'Türkçe', value: 'tr' }
                )),
    
    // Explicitly set this to false to handle replies ourselves
    deferReply: false,
    ephemeral: true,
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild?.id;
            
            // Get language from option or use guild default
            const langOption = interaction.options.getString('language');
            const lang = langOption || (guildId ? await getLanguage(guildId) : 'en');
            
            // Get all commands from the client
            const commands = interaction.client.commands;
            
            if (!commands.size) {
                const noCommandsMessage = answers.help.no_commands[lang] || answers.help.no_commands.en;
                return interaction.reply({ content: noCommandsMessage, flags: { ephemeral: true } });
            }
            
            const helpEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(answers.help.title[lang] || answers.help.title.en)
                .setDescription(answers.help.description[lang] || answers.help.description.en);
            
            // Group commands by category if specified, otherwise list alphabetically
            const sortedCommands = Array.from(commands.values()).sort((a, b) => 
                a.data.name.localeCompare(b.data.name)
            );
            
            // Add each command to the embed
            for (const command of sortedCommands) {
                // Get localized description if available in answers.js
                let description = command.data.description;
                
                // Check if we have a localized description in answers.js
                if (answers.help[command.data.name] && answers.help[command.data.name][lang]) {
                    description = answers.help[command.data.name][lang];
                } else if (answers.help[command.data.name] && answers.help[command.data.name].en) {
                    // Fallback to English
                    description = answers.help[command.data.name].en;
                }
                
                helpEmbed.addFields({ 
                    name: `/${command.data.name}`, 
                    value: description 
                });
            }
            
            helpEmbed.setFooter({ text: 'NeuroBalbes' });
            
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

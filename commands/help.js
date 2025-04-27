import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';

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
            const lang = langOption || await getServerLanguage(guildId);
            
            // Get all commands from the client
            const commands = interaction.client.commands;
            
            if (!commands.size) {
                const noCommandsMessage = await getLocalizedString(answers, 'help', 'no_commands', lang);
                return interaction.reply({ content: noCommandsMessage, ephemeral: true });
            }
            
            const title = await getLocalizedString(answers, 'help', 'title', lang);
            const description = await getLocalizedString(answers, 'help', 'description', lang);
            
            const helpEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(title)
                .setDescription(description);
            
            // Group commands by category if specified, otherwise list alphabetically
            const sortedCommands = Array.from(commands.values()).sort((a, b) => 
                a.data.name.localeCompare(b.data.name)
            );
            
            // Add each command to the embed
            for (const command of sortedCommands) {
                // Get localized description if available in answers.js
                let description = command.data.description;
                
                // Check if we have a localized description in answers.js
                const localizedDescription = await getLocalizedString(answers, 'help', command.data.name, lang);
                if (localizedDescription) {
                    description = localizedDescription;
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
                    ephemeral: true
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
                    ephemeral: true
                });
            }
        }
    }
};

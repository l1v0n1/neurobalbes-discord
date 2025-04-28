import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';
import logger from '../src/utils/logger.js';

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
    
    // These are handled by the central interaction handler now
    // deferReply: false, 
    // ephemeral: true, 

    async execute(interaction) {
        try {
            // Defer reply immediately using flags
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            const guildId = interaction.guild?.id;
            
            // Get language from option or use guild default
            const langOption = interaction.options.getString('language');
            const lang = langOption || await getServerLanguage(guildId);
            
            // Get all commands from the client
            const commands = interaction.client.commands;
            
            if (!commands.size) {
                const noCommandsMessage = await getLocalizedString(answers, 'help', 'no_commands', lang);
                return interaction.editReply({ content: noCommandsMessage });
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
            
            // Since we've already deferred the reply, just edit it
            return interaction.editReply({
                embeds: [helpEmbed]
            });
        } catch (error) {
            logger.error('Error in help command', { 
                error,
                guildId: interaction.guild?.id,
                userId: interaction.user.id
            });
            
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: 'An error occurred while retrieving help information. Please try again later.'
                });
            } else if (!interaction.replied) {
                // Use flags for ephemeral error reply
                return interaction.reply({ 
                    content: 'An error occurred while retrieving help information. Please try again later.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};

import { SlashCommandBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getLanguage, updateLanguage } from '../src/database/methods.js';

export default {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription('Change the bot language')
		.addStringOption(option =>
			option.setName('lang')
				.setDescription('Select a language')
				.setRequired(true)
				.addChoices(
					{ name: 'English', value: 'en' },
					{ name: 'Русский', value: 'ru' },
					{ name: 'Українська', value: 'ua' }
				)),
	async execute(interaction) {
		try {
			if (!interaction.guild) {
				return interaction.reply({ 
					content: 'This command can only be used in a server.',
					ephemeral: true 
				});
			}

			const guildId = interaction.guild.id;
			const newLang = interaction.options.getString('lang');
			
			// Get current language for response
			const currentLang = await getLanguage(guildId);
			
			// Update language in database
			await updateLanguage(guildId, newLang);
			
			// Send confirmation message in the selected language
			const responseMessage = answers.language.changed[newLang] || answers.language.changed.en;
			
			return interaction.reply({
				content: responseMessage,
				ephemeral: true
			});
		} catch (error) {
			console.error('Error in language command:', error);
			const errorMessage = answers.common?.database_error?.en || 'An error occurred. Please try again later.';
			return interaction.reply({ content: errorMessage, ephemeral: true });
		}
	}
};
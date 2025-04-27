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
					{ name: 'Українська', value: 'uk' },
					{ name: 'Türkçe', value: 'tr' }
				)),
	// Set as ephemeral by default
	ephemeral: true,
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
			
			// Get the localized language name for the chosen language
			const languageName = answers.language.translate[newLang] || newLang;
			
			// Send confirmation message in the selected language, replacing %VAR% with the language name
			let responseMessage = answers.language.changed[newLang] || answers.language.changed.en;
			responseMessage = responseMessage.replace('%VAR%', languageName);
			
			// Let bot.js handle the deferred reply automatically - don't manually reply
			await interaction.editReply({
				content: responseMessage
			});
		} catch (error) {
			console.error('Error in language command:', error);
			const errorMessage = answers.common?.database_error?.en || 'An error occurred. Please try again later.';
			
			if (interaction.deferred) {
				await interaction.editReply({ content: errorMessage });
			} else {
				await interaction.reply({ content: errorMessage, ephemeral: true });
			}
		}
	}
};
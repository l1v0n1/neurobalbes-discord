import { SlashCommandBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getLanguage, updateLanguage } from '../src/database/methods.js';
import logger from '../src/utils/logger.js';

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
			// Don't defer here - bot.js already handles deferring
			
			if (!interaction.guild) {
				return interaction.editReply({ 
					content: 'This command can only be used in a server.'
				});
			}

			const guildId = interaction.guild.id;
			const newLang = interaction.options.getString('lang');
			
			// Get current language for response
			const currentLang = await getLanguage(guildId);
			
			// If it's the same language, notify user (use proper language)
			if (currentLang === newLang) {
				const alreadyMessage = answers.language.already[currentLang] || answers.language.already.en;
				const langName = answers.language.translate[newLang] || newLang;
				return await interaction.editReply({
					content: alreadyMessage.replace('%VAR%', langName)
				});
			}
			
			// Update language in database
			await updateLanguage(guildId, newLang);
			
			// Get the localized language name for the chosen language
			const languageName = answers.language.translate[newLang];
			
			// Send confirmation message in the selected language, replacing %VAR% with the language name
			let responseMessage = answers.language.changed[newLang] || answers.language.changed.en;
			responseMessage = responseMessage.replace('%VAR%', languageName);
			
			// Edit the deferred reply
			await interaction.editReply({
				content: responseMessage
			});
		} catch (error) {
			logger.error('Error in language command', {
				error,
				guildId: interaction.guild?.id,
				userId: interaction.user.id
			});
			
			const errorMessage = answers.common?.database_error?.en || 'An error occurred. Please try again later.';
			
			// Make sure we handle this even if the interaction hasn't been deferred
			if (interaction.deferred) {
				await interaction.editReply({ content: errorMessage });
			} else {
				await interaction.reply({ content: errorMessage, ephemeral: true });
			}
		}
	}
};
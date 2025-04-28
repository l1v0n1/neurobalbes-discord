import { SlashCommandBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getLanguage, updateLanguage } from '../src/database/methods.js';
import logger from '../src/utils/logger.js';
import { getChat, changeField } from '../src/database/database.js';

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
				const langName = answers.language.translate[newLang] || getLanguageDisplayName(newLang);
				return await interaction.editReply({
					content: alreadyMessage.replace('%VAR%', langName)
				});
			}
			
			// The language display names are hardcoded here to ensure they're always available
			const languageNames = {
				'en': 'English',
				'ru': 'Русский',
				'uk': 'Українська',
				'tr': 'Türkçe'
			};
			
			// Update language in database directly using changeField for reliability
			await changeField(guildId, 'lang', newLang);
			
			// Force clear the database cache to ensure changes are immediately reflected
			// Validate changes were saved correctly
			const updatedChat = await getChat(guildId);
			if (updatedChat.lang !== newLang) {
				logger.error(`Language update failed: database shows ${updatedChat.lang} instead of ${newLang}`, {
					guildId,
					requestedLang: newLang,
					actualLang: updatedChat.lang
				});
				return interaction.editReply({
					content: 'Failed to update language. Please try again later.'
				});
			}
			
			// Use the hard-coded language name to ensure it's never null/undefined
			const languageName = languageNames[newLang];
			
			// Log the language change
			logger.info(`Language changed for guild ${guildId}`, {
				oldLanguage: currentLang,
				newLanguage: newLang,
				languageName
			});
			
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

// Helper function to get a display name for a language code
function getLanguageDisplayName(langCode) {
	const displayNames = {
		'en': 'English',
		'ru': 'Русский',
		'uk': 'Українська',
		'tr': 'Türkçe'
	};
	
	return displayNames[langCode] || langCode;
}
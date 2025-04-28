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
            
            // Log the request
            logger.info(`Language change requested`, {
                guildId,
                requestedLang: newLang,
                user: interaction.user.id
            });
            
			// Get current language for response
            const chatBefore = await getChat(guildId);
			const currentLang = chatBefore?.lang || 'en';
            
            logger.info(`Current language before change`, {
                guildId,
                currentLang,
                chatData: JSON.stringify(chatBefore)
            });
			
			// If it's the same language, notify user (use proper language)
			if (currentLang === newLang) {
				const alreadyMessage = answers.language.already[currentLang] || answers.language.already.en;
				const langName = getLanguageDisplayName(newLang);
				return await interaction.editReply({
					content: alreadyMessage.replace('%VAR%', langName)
				});
			}
			
			// Hard-coded language display names
			const languageNames = {
				'en': 'English',
				'ru': 'Русский',
				'uk': 'Українська',
				'tr': 'Türkçe'
			};
			
			// First, let's send a response to the user that we're working on it
			await interaction.editReply({
				content: `Changing language from ${getLanguageDisplayName(currentLang)} to ${getLanguageDisplayName(newLang)}...`
			});
			
			try {
                // DIRECT DATABASE UPDATE - Bypass all caching
                const result = await changeField(guildId, 'lang', newLang);
                logger.info(`Database update attempted`, {
                    guildId,
                    newLang,
                    result: JSON.stringify(result)
                });
                
                // Wait a second to ensure database writes are committed
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Verify the change directly from database
                const chatAfter = await getChat(guildId);
                const updatedLang = chatAfter?.lang;
                
                logger.info(`Language after update attempt`, {
                    guildId,
                    requestedLang: newLang,
                    actualLang: updatedLang,
                    fullChat: JSON.stringify(chatAfter)
                });
                
                if (updatedLang !== newLang) {
                    logger.error(`Language update failed, values don't match`, {
                        guildId,
                        requestedLang: newLang,
                        actualLang: updatedLang
                    });
                    
                    return interaction.editReply({
                        content: `Failed to update language. Requested: ${newLang}, actual: ${updatedLang || 'none'}`
                    });
                }
                
                // Use the hardcoded language name
                const languageName = languageNames[newLang] || newLang;
                
                // Send confirmation message in the selected language
                let responseMessage = answers.language.changed[newLang] || answers.language.changed.en;
                responseMessage = responseMessage.replace('%VAR%', languageName);
                
                await interaction.editReply({
                    content: responseMessage + `\n(Debug: lang=${updatedLang})`
                });
            } catch (dbError) {
                logger.error(`Database error during language update`, {
                    error: dbError,
                    guildId,
                    requestedLang: newLang
                });
                
                return interaction.editReply({
                    content: `Database error: ${dbError.message}`
                });
            }
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
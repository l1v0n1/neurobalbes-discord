import { SlashCommandBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { getLanguage, updateLanguage, SUPPORTED_LANGUAGES } from '../src/database/methods.js';
import logger from '../src/utils/logger.js';
import { getChat } from '../src/database/database.js';

// Define supported languages with their display names
const LANGUAGE_NAMES = {
	'en': 'English',
	'ru': 'Русский',
	'uk': 'Українська',
	'tr': 'Türkçe'
};

export default {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription('Change the bot language')
		.addStringOption(option =>
			option.setName('type')
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
            
            // === Log the ENTIRE interaction object ===
            try {
                // Use JSON.stringify with a replacer to handle potential circular references
                const getCircularReplacer = () => {
                  const seen = new WeakSet();
                  return (key, value) => {
                    if (typeof value === "object" && value !== null) {
                      if (seen.has(value)) {
                        return "[Circular]"; // Replace circular reference
                      }
                      seen.add(value);
                    }
                    return value;
                  };
                };
                logger.info('Full interaction object structure:', {
                    guildId,
                    interactionString: JSON.stringify(interaction, getCircularReplacer(), 2)
                });
            } catch(logError) {
                 logger.error('Error stringifying full interaction object:', { guildId, logError });
            }
            // ========================================
            
            logger.info('[language.js] Attempting to get language option...');
            let newLang = null;
            let optionType = 'unknown';
            try {
                 newLang = interaction.options.getString('type');
                 optionType = typeof newLang;
                 logger.info(`[language.js] getString('type') result: ${newLang}, type: ${optionType}`);
            } catch (e) {
                logger.error('[language.js] Error calling getString(\'type\'):', { guildId: guildId, error: e });
                // Keep fallback minimal as it shouldn't be needed now
                newLang = 'en'; 
            }

            // Validate language value (simplified)
            if (typeof newLang !== 'string' || !SUPPORTED_LANGUAGES.includes(newLang)) {
                 logger.error(`[language.js] Invalid or unsupported language value received: "${newLang}" (type: ${typeof newLang})`, {
                     guildId: guildId,
                     newLang: newLang,
                     type: typeof newLang
                 });
                 // Default to 'en' if validation fails
                 newLang = 'en'; 
                 logger.info('[language.js] Defaulting newLang to \'en\'.');
            }
            
            logger.info(`[language.js] Final language value to use: ${newLang}`);
            
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
            
            // Check if current language is null or invalid
            if (currentLang === null || currentLang === 'null' || currentLang === undefined || currentLang === '') {
                logger.warn(`Invalid current language detected`, {
                    guildId,
                    invalidLang: currentLang
                });
                // We'll still proceed with the change, but log the issue
            }
            
			// If it's the same language, notify user (use proper language)
			if (currentLang === newLang) {
				const alreadyMessage = answers.language.already[currentLang] || answers.language.already.en;
				const langName = LANGUAGE_NAMES[newLang];
				return await interaction.editReply({
					content: alreadyMessage.replace('%VAR%', langName)
				});
			}
			
			// First, let's send a response to the user that we're working on it
			await interaction.editReply({
				content: `Changing language from ${LANGUAGE_NAMES[currentLang] || currentLang} to ${LANGUAGE_NAMES[newLang]}...`
			});
			
			try {
                // Use updateLanguage which has our enhanced validation instead of direct database call
                const result = await updateLanguage(guildId, newLang);
                logger.info(`Database update attempted via updateLanguage`, {
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
                
                // Get language name from our constant
                const languageName = LANGUAGE_NAMES[newLang];
                
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

// Helper function has been removed since we're using SUPPORTED_LANGUAGES constant
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
            
            let newLang = 'en'; // Default value
            try {
                 newLang = interaction.options.getString('type'); 
                 // Basic validation happens below
            } catch (e) {
                // Log only if fetching the option fails unexpectedly
                logger.error('[language.js] Failed to get string option \'type\':', { guildId: guildId, error: e?.message || e });
                newLang = 'en'; // Default on error
            }

            // Validate language value (Simplified)
            if (typeof newLang !== 'string' || !SUPPORTED_LANGUAGES.includes(newLang)) {
                 logger.warn(`[language.js] Invalid or unsupported language value received: "${newLang}". Defaulting to 'en'.`, { guildId: guildId });
                 newLang = 'en'; 
            }

            // Log the request *after* validation
            logger.info(`Language change requested`, {
                guildId: guildId,
                requestedLang: newLang,
                user: interaction.user.id
            });
            
			// Get current language for response
            const chatBefore = await getChat(guildId);
			const currentLang = chatBefore?.lang || 'en'; // Rely on getChat/methods.js for db null checks
            
            // logger.info(`Current language before change`, { // Optional: Keep if needed
            //     guildId,
            //     currentLang,
            // });
            
			// If it's the same language, notify user
			if (currentLang === newLang) {
				const alreadyMessage = answers.language.already[currentLang] || answers.language.already.en;
				const langName = LANGUAGE_NAMES[newLang];
				return await interaction.editReply({
					content: alreadyMessage.replace('%VAR%', langName)
				});
			}
			
			// Send initial response
			await interaction.editReply({
				content: `Changing language from ${LANGUAGE_NAMES[currentLang] || currentLang} to ${LANGUAGE_NAMES[newLang]}...`
			});
			
			try {
                // Use updateLanguage which has enhanced validation
                const result = await updateLanguage(guildId, newLang);
                // logger.info(`Database update attempted via updateLanguage`, { // Optional
                //     guildId,
                //     newLang,
                // });
                
                // Wait briefly (optional, consider removing if not strictly needed)
                // await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verify the change
                const chatAfter = await getChat(guildId);
                const updatedLang = chatAfter?.lang;
                
                // logger.info(`Language after update attempt`, { // Optional
                //     guildId,
                //     requestedLang: newLang,
                //     actualLang: updatedLang,
                // });
                
                if (updatedLang !== newLang) {
                    logger.error(`Language update verification failed!`, {
                        guildId,
                        requestedLang: newLang,
                        actualLang: updatedLang
                    });
                    
                    return interaction.editReply({
                        content: `Failed to verify language update. Requested: ${newLang}, Actual: ${updatedLang || 'none'}`
                    });
                }
                
                // Send confirmation message
                const languageName = LANGUAGE_NAMES[newLang];
                let responseMessage = answers.language.changed[newLang] || answers.language.changed.en;
                responseMessage = responseMessage.replace('%VAR%', languageName);
                
                await interaction.editReply({
                    content: responseMessage // Removed debug info from user message
                });
            } catch (dbError) {
                logger.error(`Database error during language update`, {
                    guildId: guildId,
                    requestedLang: newLang,
                    error: dbError?.message || dbError // Log error message
                });
                
                return interaction.editReply({
                    content: `A database error occurred: ${dbError.message}`
                });
            }
		} catch (error) {
			logger.error('Error in language command', {
				error: error?.message || error,
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
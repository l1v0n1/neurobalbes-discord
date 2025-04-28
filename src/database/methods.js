import { getChat, changeField } from './database.js';

// Define supported languages
const SUPPORTED_LANGUAGES = ['en', 'ru', 'uk', 'tr'];

// Export supported languages for reuse
export { SUPPORTED_LANGUAGES };

/**
 * Get the language setting for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<string>} The language code ('en', 'ru', etc.)
 */
export async function getLanguage(guildId) {
    try {
        // logger.debug(`[getLanguage] Fetching language for guild ${guildId}`); // Optional debug
        const chat = await getChat(guildId);
        
        // Check for null, undefined, empty string or 'null' value
        let language = chat?.lang;
        if (language === null || language === undefined || language === '' || language === 'null') {
            // logger.debug(`[getLanguage] Invalid language '${language}' detected for ${guildId}, defaulting to 'en'`); // Optional debug
            language = 'en';
        }
        
        // Validate against supported languages
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            // logger.debug(`[getLanguage] Unsupported language '${language}' detected for ${guildId}, defaulting to 'en'`); // Optional debug
            language = 'en';
        }
        
        // logger.debug(`[getLanguage] Retrieved language ${language} for guild ${guildId}`); // Optional debug
        return language;
    } catch (error) {
        logger.error(`Error getting language for guild ${guildId}:`, { error: error?.message || error });
        return 'en'; // Default to English on error
    }
}

/**
 * Update the language setting for a guild
 * @param {string} guildId - The Discord guild ID
 * @param {string} language - The language code to set
 * @returns {Promise<void>}
 */
export async function updateLanguage(guildId, language) {
    let validatedLanguage = language;
    try {
        // logger.debug(`[updateLanguage] Updating language to ${language} for guild ${guildId}`); // Optional debug
        
        // Handle null, undefined, empty string or invalid language values
        if (validatedLanguage === null || validatedLanguage === undefined || validatedLanguage === '' || validatedLanguage === 'null' || !SUPPORTED_LANGUAGES.includes(validatedLanguage)) {
            // logger.warn(`[updateLanguage] Invalid language '${validatedLanguage}' for ${guildId}, defaulting to 'en'`); // Optional warn
            validatedLanguage = 'en'; // Default to English for invalid inputs
        }
        
        const result = await changeField(guildId, 'lang', validatedLanguage);
        // logger.debug(`[updateLanguage] Result from changeField: ${JSON.stringify(result)}`); // Optional debug
        
        // Verify the change (optional, relies on cache possibly being stale briefly)
        // const verifiedLang = await getLanguage(guildId);
        // if (verifiedLang !== validatedLanguage) { 
        //    logger.error(`[updateLanguage] Language verification failed! Expected ${validatedLanguage}, got ${verifiedLang} for guild ${guildId}`);
        // }
        
        return result;
    } catch (error) {
        logger.error(`Error updating language for guild ${guildId} to ${language}:`, { error: error?.message || error });
        throw error;
    }
}

/**
 * Get the talk setting for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<boolean>} Whether the bot should talk in this guild
 */
export async function getTalkSetting(guildId) {
    try {
        const chat = await getChat(guildId);
        return chat?.talk === 1;
    } catch (error) {
        console.error(`Error getting talk setting for guild ${guildId}:`, error);
        return true; // Default to true on error
    }
}

/**
 * Update the talk setting for a guild
 * @param {string} guildId - The Discord guild ID
 * @param {boolean} enabled - Whether to enable or disable talking
 * @returns {Promise<void>}
 */
export async function updateTalkSetting(guildId, enabled) {
    try {
        await changeField(guildId, 'talk', enabled ? 1 : 0);
    } catch (error) {
        console.error(`Error updating talk setting for guild ${guildId}:`, error);
        throw error;
    }
}

/**
 * Get the generation mode for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<number>} The generation mode (0 for default, 1 for literate)
 */
export async function getGenerationMode(guildId) {
    try {
        const chat = await getChat(guildId);
        return chat?.gen || 0;
    } catch (error) {
        console.error(`Error getting generation mode for guild ${guildId}:`, error);
        return 0; // Default to 0 on error
    }
}

/**
 * Update the generation mode for a guild
 * @param {string} guildId - The Discord guild ID
 * @param {number} mode - The generation mode to set
 * @returns {Promise<void>}
 */
export async function updateGenerationMode(guildId, mode) {
    try {
        await changeField(guildId, 'gen', mode);
    } catch (error) {
        console.error(`Error updating generation mode for guild ${guildId}:`, error);
        throw error;
    }
}

/**
 * Get the generation speed for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<number>} The generation speed (1-10)
 */
export async function getGenerationSpeed(guildId) {
    try {
        const chat = await getChat(guildId);
        return chat?.speed || 3;
    } catch (error) {
        console.error(`Error getting generation speed for guild ${guildId}:`, error);
        return 3; // Default to 3 on error
    }
}

/**
 * Update the generation speed for a guild
 * @param {string} guildId - The Discord guild ID
 * @param {number} speed - The generation speed to set
 * @returns {Promise<void>}
 */
export async function updateGenerationSpeed(guildId, speed) {
    try {
        await changeField(guildId, 'speed', speed);
    } catch (error) {
        console.error(`Error updating generation speed for guild ${guildId}:`, error);
        throw error;
    }
} 
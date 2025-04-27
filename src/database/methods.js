import { getChat, changeField } from './database.js';

/**
 * Get the language setting for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<string>} The language code ('en', 'ru', etc.)
 */
export async function getLanguage(guildId) {
    try {
        const chat = await getChat(guildId);
        return chat?.lang || 'en';
    } catch (error) {
        console.error(`Error getting language for guild ${guildId}:`, error);
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
    try {
        await changeField(guildId, 'lang', language);
    } catch (error) {
        console.error(`Error updating language for guild ${guildId}:`, error);
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
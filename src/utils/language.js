import { getLanguage } from '../database/methods.js';
import { getLocale } from './functions.js';

/**
 * Gets a localized string with proper fallbacks
 * @param {Object} strings - The answers object containing localized strings
 * @param {string} section - The section of the answers object (e.g., 'help', 'common')
 * @param {string} key - The key within the section
 * @param {string} lang - The language code
 * @param  {...any} vars - Variables to replace %VAR% placeholders
 * @returns {string} - The localized string or fallback
 */
export async function getLocalizedString(strings, section, key, lang, ...vars) {
    // Normalize language code (some parts use en-US, others use en)
    const normalizedLang = lang === 'en-US' ? 'en' : lang;
    
    // Get the localized string
    const localized = getLocale(strings, section, key, normalizedLang, ...vars);
    
    // Fallback to English if not found
    if (!localized && normalizedLang !== 'en') {
        return getLocale(strings, section, key, 'en', ...vars);
    }
    
    return localized || `[Missing: ${section}.${key}]`;
}

/**
 * Gets the server's language with proper error handling
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<string>} - The language code, defaults to 'en'
 */
export async function getServerLanguage(guildId) {
    if (!guildId) return 'en';
    
    try {
        return await getLanguage(guildId);
    } catch (error) {
        console.error(`Error getting language for guild ${guildId}:`, error);
        return 'en'; // Default to English on error
    }
}

/**
 * Helper function to get a translated response
 * @param {Object} interaction - The Discord interaction
 * @param {Object} strings - The answers object containing localized strings
 * @param {string} section - The section of the answers object
 * @param {string} key - The key within the section
 * @param  {...any} vars - Variables to replace %VAR% placeholders
 * @returns {Promise<string>} - The localized string
 */
export async function getCommandResponse(interaction, strings, section, key, ...vars) {
    const guildId = interaction.guild?.id;
    const lang = await getServerLanguage(guildId);
    return getLocalizedString(strings, section, key, lang, ...vars);
} 
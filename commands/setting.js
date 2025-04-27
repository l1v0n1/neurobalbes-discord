import {  SlashCommandBuilder, PermissionsBitField  } from 'discord.js';
import {  answers  } from '../assets/answers.js';
import {  languages  } from '../assets/descriptions.js';
import {  changeField, getChat, clearText  } from '../src/database/database.js';
import {  getLocale  } from '../src/utils/functions.js';

let prefix = '?';
try {
  const configModule = await import('../config.json', { with: { type: 'json' } });
  prefix = configModule.default.prefix || prefix;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    console.error("Error loading prefix from config.json:", error);
  }
}

const MIN_SPEED = 1;
const MAX_SPEED = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('setting')
        .setDescription(languages.setting.main['en-US'])
        .setDescriptionLocalizations(languages.setting.main)
        .addSubcommand(subcommand =>
            subcommand
            .setName('speed')
            .setDescription(languages.setting.speed['en-US'])
            .setDescriptionLocalizations(languages.setting.speed)
            .addIntegerOption(option => 
                option
                .setName("int")
                .setDescription(languages.setting.int['en-US'])
                .setDescriptionLocalizations(languages.setting.int)
                .setRequired(true)
                .setMinValue(MIN_SPEED)
                .setMaxValue(MAX_SPEED)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName("syntax")
            .setDescription(languages.setting.syntax['en-US'])
            .setDescriptionLocalizations(languages.setting.syntax)
            .addBooleanOption(option => 
                option
                .setName("bool")
                .setDescription(languages.setting.bool['en-US'])
                .setDescriptionLocalizations(languages.setting.bool)
                .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName("talk")
            .setDescription(languages.setting.talk['en-US'])
            .setDescriptionLocalizations(languages.setting.talk)
            .addBooleanOption(option => 
                option
                .setName("value")
                .setDescription(languages.setting.value['en-US'])
                .setDescriptionLocalizations(languages.setting.value)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('wipe')
            .setDescription(languages.setting.wipe['en-US'])
            .setDescriptionLocalizations(languages.setting.wipe)
            .addStringOption(option =>
                option.setName('action')
                    .setDescription(languages.setting.action['en-US'])
                    .setDescriptionLocalizations(languages.setting.action)
                    .setRequired(true)
                    .addChoices(
                        { name: languages.setting.clear['en-US'], value: 'clear', name_localizations: languages.setting.clear }
                    )
            )
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false),
    ephemeral: true,
    async execute(interaction) {
         if (!interaction.guildId) {
             try { await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true }); } catch {}
             return;
        }

        let currentChat;
        let currentLang = 'en-US';
        let dbErrorOccurred = false;

        try {
            try {
                currentChat = await getChat(interaction.guildId);
                currentLang = currentChat?.lang || 'en-US';
            } catch (dbError) {
                dbErrorOccurred = true;
                console.error(`DB error fetching chat for setting command pre-check in guild ${interaction.guildId}:`, dbError);
            }

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                 const denyMessage = getLocale(answers, 'common', 'access_denied', currentLang) || "You do not have permission to use this command.";
                 return await interaction.reply({ content: denyMessage });
            }

            if (dbErrorOccurred) {
                const dbErrorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "A database error occurred fetching current settings.";
                return await interaction.reply({ content: dbErrorMessage });
            }

            const subcommand = interaction.options.getSubcommand();
            let successMessage = null;
            let errorMessage = null;
            let dbField = null;
            let dbValue = null;

            try {
                switch (subcommand) {
                    case 'speed': {
                        const speed = interaction.options.getInteger('int', true);
                        if (speed < MIN_SPEED || speed > MAX_SPEED) {
                             errorMessage = getLocale(answers, 'setting', 'speed_wrong', currentLang, MIN_SPEED, MAX_SPEED) || `Speed must be between ${MIN_SPEED} and ${MAX_SPEED}.`;
                             break;
                        }
                        if (currentChat?.speed === speed) {
                             errorMessage = getLocale(answers, 'setting', 'already', currentLang) || "This setting already has the selected value.";
                             break;
                        }
                        dbField = 'speed';
                        dbValue = speed;
                        successMessage = getLocale(answers, 'setting', 'speed_changed', currentLang, speed) || `Speed changed to ${speed}.`;
                        break;
                    }
                    case 'syntax': {
                        const syntax = interaction.options.getBoolean('bool', true);
                        const newGen = syntax ? 1 : 0;
                        if (currentChat?.gen === newGen) {
                            errorMessage = getLocale(answers, 'setting', 'already', currentLang) || "This setting already has the selected value.";
                            break;
                        }
                        dbField = 'gen';
                        dbValue = newGen;
                        const localeKey = syntax ? 'genering_syntax' : 'genering_default';
                        successMessage = getLocale(answers, 'setting', localeKey, currentLang) || (syntax ? "Generation mode set to literate." : "Generation mode set to default.");
                        break;
                    }
                    case 'talk': {
                        const talk = interaction.options.getBoolean('value', true);
                        const newTalk = talk ? 1 : 0;
                         if (currentChat?.talk === newTalk) {
                            errorMessage = getLocale(answers, 'setting', 'already', currentLang) || "This setting already has the selected value.";
                            break;
                        }
                        dbField = 'talk';
                        dbValue = newTalk;
                        const localeKey = talk ? 'access_write' : 'denied_write';
                        successMessage = getLocale(answers, 'setting', localeKey, currentLang) || (talk ? "Bot will now respond automatically." : "Bot will now only respond when mentioned or using prefix.");
                        break;
                    }
                    case 'wipe': {
                        const action = interaction.options.getString('action', true);
                        if (action === 'clear') {
                            try {
                                 await clearText(interaction.guildId);
                                 successMessage = getLocale(answers, 'setting', 'success_wipe', currentLang) || "Textbase successfully wiped.";
                            } catch (wipeError) {
                                 console.error(`DB error wiping textbase for guild ${interaction.guildId}:`, wipeError);
                                 errorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "Database error during wipe operation.";
                             }
                         } else {
                             errorMessage = "Invalid wipe action.";
                         }
                         break;
                    }
                    default:
                         errorMessage = "Unknown setting subcommand.";
                         break;
                }

                if (errorMessage) {
                    return await interaction.reply({ content: errorMessage });
                }

                if (subcommand === 'wipe') {
                     if (successMessage) {
                         return await interaction.reply({ content: successMessage });
                     } else {
                         return await interaction.reply({ content: errorMessage || "An error occurred during wipe." });
                     }
                }

                if (dbField !== null && dbValue !== null) {
                     await changeField(interaction.guildId, dbField, dbValue);
                     const finalMessage = successMessage || "Setting updated successfully.";
                     await interaction.reply({ content: finalMessage });
                } else if (subcommand !== 'wipe') {
                     console.error(`Setting command reached end without action for ${subcommand} in guild ${interaction.guildId}`);
                     await interaction.reply({ content: "An internal error occurred processing the setting." });
                }

            } catch (dbChangeError) {
                 console.error(`DB error applying setting change (${subcommand}) for guild ${interaction.guildId}:`, dbChangeError);
                 const dbErrorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "A database error occurred while changing the setting.";
                 await interaction.reply({ content: dbErrorMessage });
            }
        } catch (error) {
            console.error(`Error executing setting command for guild ${interaction.guildId}:`, error);
             if (interaction.deferred || interaction.replied) {
                 try {
                     await interaction.reply({ content: "An unexpected error occurred." });
                 } catch (editError) {
                     console.error("Failed to send final error reply for setting command:", editError);
                 }
             }
        }
    }
};


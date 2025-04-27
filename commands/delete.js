import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { remove, getChat } from '../src/database/database.js';
import { languages } from '../assets/descriptions.js';
import { answers } from '../assets/answers.js';
import { getLocale } from '../src/utils/functions.js';

export default {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription(languages.delete.main['en-US'])
        .setDescriptionLocalizations(languages.delete.main)
        .addSubcommand(subcommand =>
            subcommand
            .setName('mention')
            .setDescription(languages.delete.mention['en-US'])
            .setDescriptionLocalizations(languages.delete.mention)
            .addUserOption(option =>
                option
                .setName('user')
                .setDescription(languages.delete.user['en-US'])
                .setDescriptionLocalizations(languages.delete.user)
                .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName("string")
            .setDescription(languages.delete.string['en-US'])
            .setDescriptionLocalizations(languages.delete.string)
            .addStringOption(option =>
                option.setName('input')
                    .setDescription(languages.delete.input['en-US'])
                    .setDescriptionLocalizations(languages.delete.input)
                    .setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false),
    // Set ephemeral flag for admin commands
    ephemeral: true,
    async execute(interaction) {
        if (!interaction.guildId) {
            try { 
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "This command can only be used in a server.", flags: { ephemeral: true } });
                }
            } catch {}
            return;
        }

        let currentChat;
        let currentLang = 'en-US';
        let dbErrorOccurred = false;

        try {
            // Remove manual deferReply - this is handled by bot.js

            try {
                currentChat = await getChat(interaction.guildId);
                currentLang = currentChat?.lang || 'en-US';
            } catch (dbError) {
                dbErrorOccurred = true;
                console.error(`DB error fetching chat for delete command pre-check in guild ${interaction.guildId}:`, dbError);
            }

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const denyMessage = getLocale(answers, 'common', 'access_denied', currentLang) || "You do not have permission to use this command.";
                return await interaction.editReply({ content: denyMessage });
            }

            if (dbErrorOccurred) {
                const dbErrorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "A database error occurred fetching current settings.";
                return await interaction.editReply({ content: dbErrorMessage });
            }

            const subcommand = interaction.options.getSubcommand();
            let valueToRemove = null;
            let localeSuccessKey = 'mention';

            if (subcommand === 'mention') {
                const user = interaction.options.getUser('user', true);
                valueToRemove = user.id;
                localeSuccessKey = 'mention';
            } else if (subcommand === 'string') {
                valueToRemove = interaction.options.getString('input', true);
                localeSuccessKey = 'string';
            } else {
                console.error(`Unknown subcommand ${subcommand} in delete command for guild ${interaction.guildId}`);
                return await interaction.editReply({ content: "Invalid command option." });
            }

            if (valueToRemove === null || (typeof valueToRemove === 'string' && valueToRemove.trim() === '')) {
                return await interaction.editReply({ content: "Invalid value provided for removal." });
            }

            try {
                await remove(interaction.guildId, valueToRemove);
                const successMessage = getLocale(answers, 'delete', localeSuccessKey, currentLang) || "Successfully removed entries.";
                await interaction.editReply({ content: successMessage });

            } catch (removeError) {
                console.error(`DB error removing data (${subcommand} - ${valueToRemove}) for guild ${interaction.guildId}:`, removeError);
                const dbErrorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "A database error occurred during removal.";
                await interaction.editReply({ content: dbErrorMessage });
            }

        } catch (error) {
            console.error(`Error executing delete command for guild ${interaction.guildId}:`, error);
            if (interaction.deferred || interaction.replied) {
                try {
                    await interaction.editReply({ content: "An unexpected error occurred." });
                } catch (editError) {
                    console.error("Failed to send final error reply for delete command:", editError);
                }
            }
        }
    }
};

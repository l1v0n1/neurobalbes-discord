const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { changeField, getChat } = require('../database');
const { languages } = require('../assets/descriptions');
const { answers } = require('../assets/answers');
const { getLocale } = require('../functions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription(languages.language.main['en-US'])
		.setDescriptionLocalizations(languages.language.main)
		.addStringOption(option =>
			option.setName('type')
				.setDescription(languages.language.type['en-US'])
				.setDescriptionLocalizations(languages.language.type)
				.setRequired(true)
				.addChoices(
					{ name: languages.language.lang.ru, value: 'ru' },
					{ name: languages.language.lang['en-US'], value: 'en' },
					{ name: languages.language.lang.uk, value: 'uk' },
					{ name: languages.language.lang.tr, value: 'tr' },
				))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
		.setDMPermission(false),
	async execute(interaction) {
		if (!interaction.guildId) {
			try { await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true }); } catch {}
			return;
		}

		try {
			await interaction.deferReply({ ephemeral: true });

			let currentChat;
			let currentLang = 'en-US';
			try {
				currentChat = await getChat(interaction.guildId);
				currentLang = currentChat?.lang || 'en-US';
			} catch (dbError) {
				console.error(`DB error fetching chat for language command pre-check in guild ${interaction.guildId}:`, dbError);
			}

			if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
				const denyMessage = getLocale(answers, 'common', 'access_denied', currentLang) || "You do not have permission to use this command.";
				return await interaction.editReply({ content: denyMessage, ephemeral: true });
			}

			const targetLang = interaction.options.getString('type', true);

			if (currentChat?.lang === targetLang) {
				const langName = answers?.language?.translate?.[targetLang] || targetLang;
				const alreadyMessage = getLocale(answers, 'language', 'already', currentLang, langName) || `Language is already set to ${langName}.`;
				return await interaction.editReply({ content: alreadyMessage, ephemeral: true });
			}

			try {
				await changeField(interaction.guildId, 'lang', targetLang);
			} catch (dbError) {
				console.error(`DB error changing language for guild ${interaction.guildId}:`, dbError);
				const dbErrorMessage = getLocale(answers, 'common', 'database_error', currentLang) || "A database error occurred.";
				return await interaction.editReply({ content: dbErrorMessage, ephemeral: true });
			}

			const langName = answers?.language?.translate?.[targetLang] || targetLang;
			const changedMessage = getLocale(answers, 'language', 'changed', targetLang, langName) || `Language changed to ${langName}.`;
			await interaction.editReply({ content: changedMessage, ephemeral: true });
		} catch (error) {
			console.error(`Error executing language command for guild ${interaction.guildId}:`, error);
			if (interaction.deferred || interaction.replied) {
				try {
					await interaction.editReply({ content: "An unexpected error occurred.", ephemeral: true });
				} catch (editError) {
					console.error("Failed to send final error reply for language command:", editError);
				}
			}
		}
	}
}
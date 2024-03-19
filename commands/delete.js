const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { remove, getChat } = require('../database')
const { languages } = require('../assets/descriptions');
const { answers } = require('../assets/answers');
const { getLocale, getLocaleWithoutString } = require('../functions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription(languages.delete.main['en-US'])
        .setDescriptionLocalizations(languages.delete.main)
        .addSubcommand(subcommand =>
            subcommand
            .setName('mention')
            .setDescription(languages.delete.mention['en-US'])
            .setDescriptionLocalizations(languages.delete.mention)
            .addMentionableOption(option =>
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
        ),
    async execute(interaction) {
        if (interaction.guildId == null) {
            return;
        }
        await interaction.reply(`⏳`);
        const chat = await getChat(interaction.guildId);
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.editReply({ content: getLocaleWithoutString(answers, 'access_denied', chat.lang), ephemeral: true });
        }

        const option = interaction.options.getSubcommand();
        const args = (option === 'mention') ? interaction.options.get('user').value : interaction.options.get('input').value;
        await remove(interaction.guildId, args);
        return await interaction.editReply(getLocale(answers, 'delete', option, chat.lang));
    }
};

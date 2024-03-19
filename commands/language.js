const { SlashCommandBuilder, PermissionsBitField  } = require('discord.js');
const { changeField, getChat } = require('../database')
const { languages } = require('../assets/descriptions');
const { answers } = require('../assets/answers');
const { getLocaleWithoutString, getLocale } = require('../functions');

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
        ,
	async execute(interaction) {
        if (interaction.guildId != null) {
            await interaction.reply(`⏳`);
            let chat = await getChat(interaction.guildId)
            if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) == true) {
                let lang = interaction.options.get("type").value
                switch (chat.lang) {
                    case lang:
                        return await interaction.editReply({
                            content: getLocale(answers, 'language', 'already', lang, answers.language.translate[lang]),
                            ephemeral: true
                        });
                    default:
                        await changeField(interaction.guildId, 'lang', lang)
                        return await interaction.editReply(getLocale(answers, 'language', 'changed', lang, answers.language.translate[lang]))
                }
            } else return await interaction.editReply({ content: getLocaleWithoutString(answers, 'access_denied', chat.lang), ephemeral: true })
        }
	}
}
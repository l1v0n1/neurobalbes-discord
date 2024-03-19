const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { answers } = require('../assets/answers');
const { languages } = require('../assets/descriptions');
const { prefix } = require('../config.json').prefix;
const { changeField, getChat, clearText } = require('../database');
const { getLocale, getLocaleWithoutString } = require('../functions');

module.exports = {
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
        ,
        async execute(interaction) {
            if (interaction.guildId == null) {
              return;
            }
            await interaction.reply(`⏳`);
            const chat = await getChat(interaction.guildId);
          
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
              return await interaction.editReply({ content: getLocaleWithoutString(answers, 'access_denied', chat.lang) });
            }
          
            const scommand = interaction.options.getSubcommand();
            switch (scommand) {
              case 'speed':
                const speed = interaction.options.get('int').value;
                if (speed < 1 || speed > 10) {
                  return await interaction.editReply({ content: getLocale(answers, 'setting', 'speed_wrong', chat.lang, prefix) });
                }
          
                if (chat['speed'] === speed) {
                  return await interaction.editReply({ content: getLocale(answers, 'setting', 'already', chat.lang) });
                }
          
                await changeField(interaction.guildId, 'speed', speed);
                return await interaction.editReply(getLocale(answers, 'setting', 'speed_changed', chat.lang, speed));
              case 'syntax':
                const syntax = interaction.options.get('bool').value;
                const newGen = syntax ? 1 : 0;
                if (chat['gen'] === newGen) {
                  return await interaction.editReply({ content: getLocale(answers, 'setting', 'already', chat.lang) });
                }
          
                await changeField(interaction.guildId, 'gen', newGen);
                return await interaction.editReply(getLocale(answers, 'setting', syntax ? 'genering_syntax' : 'genering_default', chat.lang));
              case 'talk':
                const talk = interaction.options.get('value').value;
                const newTalk = talk ? 1 : 0;
                if (chat['talk'] === newTalk) {
                  return await interaction.editReply({ content: getLocale(answers, 'setting', 'already', chat.lang) });
                }
          
                await changeField(interaction.guildId, 'talk', newTalk);
                return await interaction.editReply(getLocale(answers, 'setting', talk ? 'access_write' : 'denied_write', chat.lang));
              case 'wipe':
                const wipe = interaction.options.get('action').value;
                if (wipe === 'clear') {
                  await clearText(interaction.guildId);
                  return await interaction.editReply(getLocale(answers, 'setting', 'success_wipe', chat.lang));
                }
            }
          }
};


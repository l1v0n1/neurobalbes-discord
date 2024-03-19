"use strict";

const { SlashCommandBuilder } = require('discord.js');
const { answers } = require('../assets/answers');
const { languages } = require('../assets/descriptions');
const { getChat } = require('../database');
const { getLocale } = require('../functions');
const { prefix } = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription(languages.info.main['en-US'])
    .setDescriptionLocalizations(languages.info.main),
  async execute(interaction) {
    if (!interaction.guildId) return;

    await interaction.reply('⏳');
    const chat = await getChat(interaction.guildId);
    const { talk, gen, speed, textbase, lang } = chat;

    const speed_text = getLocale(answers, 'info', 'speed', lang, speed);
    const literate = getLocale(answers, 'info', 'literate', lang);
    const def = getLocale(answers, 'info', 'default', lang);

    const syntax = gen === 1 ? literate : def;
    const mode_text = getLocale(answers, 'info', 'mode', lang, syntax);

    const silent = getLocale(answers, 'info', 'bot_silent', lang, prefix);

    const mode = `${mode_text}\n${speed_text}`;

    const active = talk === 0 ? silent : mode;
    const serverID = getLocale(answers, 'info', 'serverID', lang, interaction.guildId);
    const saved_count = getLocale(answers, 'info', 'saved_count', lang, textbase.length);
    const message = `${serverID}\n${saved_count}\n\n${active}`;

    await interaction.editReply(message);
  }
};

const { SlashCommandBuilder } = require('discord.js');
const { getChat } = require('../database')
const { contains, choice } = require('../functions');
const { languages } = require('../assets/descriptions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('continue')
		.setDescription(languages.continue.main['en-US'])
        .setDescriptionLocalizations(languages.continue.main)
        .addStringOption(option => 
            option
            .setName("phrase")
            .setDescription(languages.continue.phrase['en-US'])
            .setDescriptionLocalizations(languages.continue.phrase)
            .setRequired(true)
            ),
	async execute(interaction) {
        if (interaction.guildId != null) {
            await interaction.reply(`⏳`);
            let phrase = interaction.options.get("phrase").value
            let chat = await getChat(interaction.guildId)
            let elements = contains(chat["textbase"], phrase)
            if (elements == [] || elements.length < 1) return await interaction.editReply(phrase)
            else return await interaction.editReply(choice(elements))
        }
	}
};
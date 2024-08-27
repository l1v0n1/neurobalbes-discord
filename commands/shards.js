const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { languages } = require('../assets/descriptions');
const { adminId } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shards')
		.setDescription('Bot shards')
		.setDescriptionLocalizations(languages.shards.main)
        ,
	async execute(interaction) {
		await interaction.reply(`⏳`);
		if (interaction.user.id == adminId) {
			interaction.client.shard.broadcastEval(client => [client.shard.ids, client.ws.status, client.ws.ping, client.guilds.cache.size])
			.then((results) =>{
				const embed = new EmbedBuilder()
					.setTitle(`👨‍💻 Bot Shards (${interaction.client.shard.count})`)
					.setColor('#ccd6dd')
					.setTimestamp();
				
				results.map((data) => {
					embed.addFields({name: `📡 Shard ${data[0]}`, value: `**Status:** ${data[1]}\n**Ping:** ${data[2]}ms\n**Guilds:** ${data[3]}`})
				});
				return interaction.editReply({ content: null, embeds: [embed] }).catch(() => {/*Ignore error*/});
			})
			.catch((error) => {
				console.error(error);
				return interaction.editReply(`❌ Error.`).catch(() => {/*Ignore error*/});
			});
		} else return await interaction.editReply("Access denied").catch(() => {/*Ignore error*/})
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { languages } = require('../assets/descriptions');
const { adminId, inviteLink, serverLink } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Bot stats')
		.setDescriptionLocalizations(languages.stats.main)
        ,
	async execute(interaction) {
		await interaction.reply(`⏳`);
		if (interaction.user.id == adminId) {
			const promises = [
				interaction.client.shard.fetchClientValues('guilds.cache.size').catch(() => {/*Ignore error*/}),
				interaction.client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)).catch(() => {/*Ignore error*/}),
				interaction.client.shard.fetchClientValues('channels.cache.size').catch(() => {/*Ignore error*/})
			];

			return Promise.all(promises)
				.then(results => {
					const totalGuilds = results[0].reduce((acc, guildCount) => acc + guildCount, 0);
					const totalMembers = results[1].reduce((acc, memberCount) => acc + memberCount, 0);
					const totalChannels = results[2].reduce((acc, channelCount) => acc + channelCount, 0);

					const Embed = new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Статистика бота')
					.setAuthor({ name: 'Нейробалбес', iconURL: 'https://cdn.discordapp.com/attachments/972927251127619707/1002244637823602718/1658514115789.png'})
					.addFields(
						{ name: '**Серверов**', value: `${totalGuilds}` },
						{ name: '**Каналов**', value: `${totalChannels}`  },
						{ name: '**Всего участников**', value: `${totalMembers}` },
					)
					.addFields({ name: '**Сервер бота**', value: `[клик](${serverLink})` })
					.addFields({ name: '**Добавить меня на сервер**', value: `[клик](${inviteLink})` });
					
					return interaction.editReply({embeds: [Embed]}).catch(() => {/*Ignore error*/});
				})
				.catch(console.error);
			} else return await interaction.editReply("Access denied").catch(() => {/*Ignore error*/})
    }
};

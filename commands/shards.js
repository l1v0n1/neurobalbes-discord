import {  SlashCommandBuilder, EmbedBuilder, Status, MessageFlags } from 'discord.js';
import {  languages  } from '../assets/descriptions.js';
import { answers } from '../assets/answers.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';
import logger from '../src/utils/logger.js';

// Attempt to load adminId, handle if config.json or key is missing
let adminId = null;
try {
  const configModule = await import('../config.json', { with: { type: 'json' } });
  adminId  = configModule.default.adminId;
} catch (error) {
	if (error.code !== 'MODULE_NOT_FOUND') {
		console.error("Error loading adminId from config.json:", error);
	}
	// adminId remains null
}

// Map ws status codes to readable strings
const statusMap = {
	[Status.Ready]: 'Ready',
	[Status.Connecting]: 'Connecting',
	[Status.Reconnecting]: 'Reconnecting',
	[Status.Idle]: 'Idle',
	[Status.Nearly]: 'Nearly',
	[Status.Disconnected]: 'Disconnected',
	// Add other statuses if necessary
};

export default {
	data: new SlashCommandBuilder()
		.setName('shards')
		.setDescription('Shows information about bot shards (Admin only)')
		.setDescriptionLocalizations(languages.shards.main)
		.setDMPermission(false), // Shard info is not relevant in DMs
	async execute(interaction) {
		try {
			if (!adminId) {
				console.error("Admin ID is not configured in config.json for shards command.");
				await interaction.editReply({ content: "Command configuration error: Admin ID not set." });
				return;
			}

			if (interaction.user.id !== adminId) {
				// Use a localized deny message if available, otherwise fallback
				// let lang = await fetchLang(interaction.guildId); // Need a way to get lang if needed
				// const denyMessage = getLocale(answers, 'common', 'access_denied', lang) || "Access denied."; 
				await interaction.editReply({ content: "Access denied." }); // Keep ephemeral
				return;
			}

			// Check if sharding is enabled
			if (!interaction.client.shard) {
				await interaction.editReply({ content: "Sharding is not enabled for this bot." });
				return;
			}

			const results = await interaction.client.shard.broadcastEval(client => [
				client.shard.ids[0], // Get the first (should be only) shard ID in this process
				client.ws.status,
				Math.round(client.ws.ping), // Round ping
				client.guilds.cache.size
			]);

			const embed = new EmbedBuilder()
				.setTitle(`👨‍💻 Bot Shards (${interaction.client.shard.count})`)
				.setColor('#ccd6dd') // Consider making color a constant
				.setTimestamp();

			results.forEach((data) => { // Use forEach for clarity as map return value isn't used
				const shardId = data[0];
				const statusNumber = data[1];
				const ping = data[2];
				const guildCount = data[3];
				const statusString = statusMap[statusNumber] || `Unknown (${statusNumber})`; // Map status number to string

				embed.addFields({
					name: `📡 Shard ${shardId}`,
					// Use inline: true for potentially better layout with many shards
					value: `**Status:** ${statusString}\n**Ping:** ${ping}ms\n**Guilds:** ${guildCount}`,
					inline: true
				});
			});

			await interaction.editReply({ embeds: [embed] });

		} catch (error) {
			logger.error('Error executing shards command:', { error });
			const errorMessage = await getLocalizedString(answers, 'shards', 'error', lang);
			// Use flags for ephemeral error reply
			await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
		}
	}
};

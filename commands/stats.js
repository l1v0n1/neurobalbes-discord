const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { languages } = require('../assets/descriptions');
const { answers } = require('../assets/answers');
const { getLocale } = require('../functions');

// Attempt to load config, handle if missing
let config = { adminId: null, inviteLink: null, serverLink: null };
try {
	config = require('../config.json');
	// Ensure required keys exist, provide defaults or mark as missing
	config.adminId = config.adminId || null;
	config.inviteLink = config.inviteLink || null;
	config.serverLink = config.serverLink || null;
} catch (error) {
	if (error.code !== 'MODULE_NOT_FOUND') {
		console.error("Error loading config.json for stats command:", error);
	}
	// Config retains default null values
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Shows bot statistics (Admin only)')
		.setDescriptionLocalizations(languages.stats.main)
		.setDMPermission(false),
	async execute(interaction) {
		let lang = 'en-US'; // Default lang

		try {
			await interaction.deferReply({ ephemeral: true });

			// --- Config & Permission Checks ---
			if (!config.adminId) {
				console.error("Admin ID is not configured for stats command.");
				return await interaction.editReply({ content: "Command configuration error: Admin ID not set." });
			}
			if (!config.inviteLink || !config.serverLink) {
				console.warn("Invite link or server link is not configured for stats command.");
				// Decide if command should proceed with missing links or halt
				// return await interaction.editReply({ content: "Command configuration error: Bot links not set." });
			}

			if (interaction.user.id !== config.adminId) {
				// Fetch lang if needed for localized deny message
				// try { lang = (await getChat(interaction.guildId))?.lang || 'en-US'; } catch {}
				const denyMessage = getLocale(answers, 'common', 'access_denied', lang) || "Access denied.";
				return await interaction.editReply({ content: denyMessage });
			}

			// --- Sharding Checks ---
			if (!interaction.client.shard) {
				return await interaction.editReply({ content: "Sharding is not enabled for this bot." });
			}

			// --- Fetch Stats ---
			// Use Promise.allSettled to handle potential errors from individual shards
			const promises = [
				interaction.client.shard.fetchClientValues('guilds.cache.size'),
				interaction.client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)),
				interaction.client.shard.fetchClientValues('channels.cache.size')
			];
			const results = await Promise.allSettled(promises);

			let totalGuilds = 0;
			let totalMembers = 0;
			let totalChannels = 0;
			let fetchErrors = false;

			// Process Guilds
			if (results[0].status === 'fulfilled') {
				totalGuilds = results[0].value.reduce((acc, count) => acc + count, 0);
			} else {
				console.error("Stats command: Failed to fetch guild counts:", results[0].reason);
				fetchErrors = true;
			}

			// Process Members
			if (results[1].status === 'fulfilled') {
				totalMembers = results[1].value.reduce((acc, count) => acc + count, 0);
			} else {
				console.error("Stats command: Failed to fetch member counts:", results[1].reason);
				fetchErrors = true;
			}

			// Process Channels
			if (results[2].status === 'fulfilled') {
				totalChannels = results[2].value.reduce((acc, count) => acc + count, 0);
			} else {
				console.error("Stats command: Failed to fetch channel counts:", results[2].reason);
				fetchErrors = true;
			}

			// --- Build Embed (Localize!) ---
			// Fetch lang properly if needed for localization
			// try { lang = (await getChat(interaction.guildId))?.lang || 'en-US'; } catch {}

			const embedTitle = getLocale(answers, 'stats', 'embed_title', lang) || 'Bot Statistics';
			const authorName = getLocale(answers, 'stats', 'author_name', lang) || 'NeuroBalbes'; // Example key
			const guildsLabel = getLocale(answers, 'stats', 'guilds_label', lang) || 'Servers';
			const channelsLabel = getLocale(answers, 'stats', 'channels_label', lang) || 'Channels';
			const membersLabel = getLocale(answers, 'stats', 'members_label', lang) || 'Total Users';
			const serverLinkLabel = getLocale(answers, 'stats', 'server_link_label', lang) || 'Support Server';
			const inviteLinkLabel = getLocale(answers, 'stats', 'invite_link_label', lang) || 'Add Me';
			const linkText = getLocale(answers, 'stats', 'link_text', lang) || 'Click';
			const botIconURL = 'https://cdn.discordapp.com/attachments/972927251127619707/1002244637823602718/1658514115789.png'; // Keep URL or make configurable?

			const statsEmbed = new EmbedBuilder()
				.setColor(0x0099FF) // Consider making color a constant
				.setTitle(embedTitle + (fetchErrors ? " (Partial)" : "")) // Indicate if data is partial
				.setAuthor({ name: authorName, iconURL: botIconURL })
				.addFields(
					{ name: `**${guildsLabel}**`, value: `${totalGuilds}`, inline: true },
					{ name: `**${channelsLabel}**`, value: `${totalChannels}`, inline: true },
					{ name: `**${membersLabel}**`, value: `${totalMembers}`, inline: true }
				)
				.setTimestamp();

			// Add links only if they are configured
			if (config.serverLink) {
				statsEmbed.addFields({ name: `**${serverLinkLabel}**`, value: `[${linkText}](${config.serverLink})`, inline: true });
			}
			if (config.inviteLink) {
				statsEmbed.addFields({ name: `**${inviteLinkLabel}**`, value: `[${linkText}](${config.inviteLink})`, inline: true });
			}

			if (fetchErrors) {
				statsEmbed.setFooter({ text: "Some statistics might be inaccurate due to shard errors." });
			}

			await interaction.editReply({ embeds: [statsEmbed] });

		} catch (error) {
			console.error("Error executing stats command:", error);
			const errorMessage = "An error occurred while fetching statistics.";
			if (interaction.deferred || interaction.replied) {
				try {
					await interaction.editReply({ content: errorMessage });
				} catch (editError) {
					console.error("Failed to send error reply for stats command:", editError);
				}
			}
		}
	}
};

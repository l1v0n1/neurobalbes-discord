import { Client, Events, GatewayIntentBits, Collection, ChannelType, PermissionsBitField, ActivityType, Partials, version as djsVersion } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

logger.info(`Using discord.js version: ${djsVersion}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set shard ID for logger
if (process.env.SHARD_ID) {
	logger.setShardId(process.env.SHARD_ID);
}

// Constants
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
const MENTION_REGEX = /<@!?(\d+)>/g;
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

// Safer config loading with defaults
let config = {
	token: process.env.BOT_TOKEN,
	prefix: process.env.PREFIX || '/',
	bot_description: process.env.BOT_DESCRIPTION || 'Neurobalbes | Type /help for commands',
	clientId: process.env.CLIENT_ID,
	raw_limit: parseInt(process.env.RAW_LIMIT || '2000', 10)
};

try {
	const userConfig = await import('../../config.json', { with: { type: 'json' } });
	config = { ...config, ...userConfig.default };
	logger.info(`Configuration loaded from config.json`);
} catch (error) {
	logger.warn(`Could not load config.json, using defaults and environment variables: ${error.message}`);
}

// Dynamic imports for ES modules
const { isURL, choice, randomInteger, range } = await import('../utils/functions.js');
const { getChat, updateText, insert, chatExists, deleteFirst } = await import('../database/database.js');
const Markov = await import('../utils/markov.js').then(module => module.default);

// Constants for better code readability
const MAX_MESSAGE_LENGTH = 1000;
const URL_PATTERNS = {
	TENOR: 'https://tenor.com/view',
	DISCORD_MEDIA: 'https://media.discordapp.net/',
	GIF_EXTENSIONS: ['.gif', '-gif']
};

// Implement connection manager with better error handling
class ConnectionManager {
	constructor() {
		this.reconnectAttempt = 0;
		this.reconnecting = false;
		this.maxReconnectAttempts = 10;
		this.baseReconnectDelay = 5000; // 5 seconds
	}

	async handleDisconnect(client, error) {
		if (error) {
			logger.error(`Disconnected with error: ${error.message}`);
		} else {
			logger.warn(`Disconnected without error`);
		}

		if (this.reconnecting) {
			logger.info(`Already attempting to reconnect...`);
			return;
		}

		this.reconnecting = true;

		if (this.reconnectAttempt < this.maxReconnectAttempts) {
			// Exponential backoff with jitter
			const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempt) + 
				Math.floor(Math.random() * 2000);
			
			this.reconnectAttempt++;
			
			logger.info(`Attempting to reconnect (${this.reconnectAttempt}/${this.maxReconnectAttempts}) in ${Math.floor(delay/1000)} seconds...`);
			
			setTimeout(() => {
				logger.info(`Reconnecting now...`);
				
				client.login(config.token)
					.then(() => {
						logger.info(`Reconnected successfully`);
						this.reconnecting = false;
					})
					.catch(err => {
						logger.error(`Failed to reconnect: ${err.message}`);
						this.reconnecting = false;
						this.handleDisconnect(client, err);
					});
			}, delay);
		} else {
			logger.error(`Maximum reconnection attempts reached (${this.maxReconnectAttempts}). Giving up.`);
			process.exit(1); // Exit for shard manager to restart this shard
		}
	}

	resetReconnectCounter() {
		if (this.reconnectAttempt > 0) {
			logger.info(`Connection stable, resetting reconnect counter from ${this.reconnectAttempt} to 0`);
		}
		this.reconnectAttempt = 0;
	}
}

// Implement memory management with optimized cache operations
class MemoryManager {
	constructor() {
		this.messageCache = new Map();
		this.cacheHits = 0;
		this.cacheMisses = 0;
		this.cacheSize = 0;
		this.lastCleanup = Date.now();
	}

	trackMessage(message) {
		// Don't cache messages with URLs, or messages from bots
		if (message.author.bot || URL_REGEX.test(message.content)) {
			return;
		}
		
		const guildId = message.guild?.id || 'dm';
		
		if (!this.messageCache.has(guildId)) {
			this.messageCache.set(guildId, new Map());
		}
		
		const guildCache = this.messageCache.get(guildId);
		
		// Use a sliding window approach - keep only the last 100 messages per channel
		const channelId = message.channel.id;
		
		if (!guildCache.has(channelId)) {
			guildCache.set(channelId, []);
		}
		
		const channelMessages = guildCache.get(channelId);
		
		// Add message to cache
		channelMessages.push({
			id: message.id,
			content: message.content,
			author: message.author.id,
			timestamp: Date.now(),
			mentions: [...message.content.matchAll(MENTION_REGEX)].map(match => match[1])
		});
		
		// Keep only last 100 messages
		if (channelMessages.length > 100) {
			channelMessages.shift();
		}
		
		this.cacheSize++;
	}

	getChannelHistory(guildId, channelId, limit = 50) {
		const guildCache = this.messageCache.get(guildId || 'dm');
		
		if (!guildCache) {
			this.cacheMisses++;
			return [];
		}
		
		const channelMessages = guildCache.get(channelId);
		
		if (!channelMessages) {
			this.cacheMisses++;
			return [];
		}
		
		this.cacheHits++;
		return channelMessages.slice(-limit);
	}

	cleanupCache() {
		const now = Date.now();
		let deletedCount = 0;
		
		// Only clean up every 30 minutes
		if (now - this.lastCleanup < CACHE_CLEANUP_INTERVAL) {
			return;
		}
		
		logger.info(`Running cache cleanup...`);
		
		this.messageCache.forEach((guildCache, guildId) => {
			guildCache.forEach((channelMessages, channelId) => {
				const initialLength = channelMessages.length;
				
				// Remove messages older than 24 hours
				const oldestAllowed = now - (24 * 60 * 60 * 1000);
				
				const newMessages = channelMessages.filter(msg => msg.timestamp >= oldestAllowed);
				const removed = initialLength - newMessages.length;
				
				deletedCount += removed;
				
				if (newMessages.length === 0) {
					// No messages left in this channel, remove the channel entry
					guildCache.delete(channelId);
				} else {
					guildCache.set(channelId, newMessages);
				}
			});
			
			// If no channels left in this guild, remove the guild entry
			if (guildCache.size === 0) {
				this.messageCache.delete(guildId);
			}
		});
		
		this.lastCleanup = now;
		this.cacheSize -= deletedCount;
		
		logger.info(`Cache cleanup complete. Removed ${deletedCount} messages, current size: ${this.cacheSize} entries`);
	}

	getCacheStats() {
		return {
			guilds: this.messageCache.size,
			channels: Array.from(this.messageCache.values()).reduce((sum, guild) => sum + guild.size, 0),
			messages: this.cacheSize,
			hits: this.cacheHits,
			misses: this.cacheMisses,
			hitRatio: this.cacheHits + this.cacheMisses > 0 ? 
				Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100) : 0
		};
	}
}

// Initialize Discord client with optimized options
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.DirectMessages
	],
	presence: {
		activities: [{
			type: ActivityType.Playing,
			name: config.bot_description
		}]
	},
	failIfNotExists: false,
	retryLimit: 5,
	ws: {
		large_threshold: 250,
		compress: true
	},
	// Better gateway options
	restTimeOffset: 750,
	restGlobalRateLimit: 50,
	partials: [
		Partials.Channel,
		Partials.Message
	]
});

const connectionManager = new ConnectionManager();
const memoryManager = new MemoryManager();

// Setup periodic cache cleanup and connection stability check
setInterval(() => {
	memoryManager.cleanupCache();
}, CACHE_CLEANUP_INTERVAL);

// Reset connection manager counters every hour if stable
setInterval(() => {
	connectionManager.resetReconnectCounter();
}, 60 * 60 * 1000);

client.commands = new Collection();

// Improved command loading with async/await
async function loadCommands() {
	client.commands = new Collection();
	const commandsPath = path.join(__dirname, '../../commands');
	logger.info(`Searching for command files in: ${commandsPath}`);

	try {
		const commandFiles = await fs.readdir(commandsPath);
		logger.info(`Found ${commandFiles.length} potential command files: ${commandFiles.join(', ')}`);

		for (const file of commandFiles) {
			if (!file.endsWith('.js')) continue;
			const filePath = path.join(commandsPath, file);
			const commandName = file.split('.')[0];
			logger.info(`Loading command file: ${filePath}`);

			try {
				// Convert file path to URL for dynamic import
				const fileUrl = new URL(`file://${filePath}`);
				const commandModule = await import(fileUrl.href);

				// Check structure of the imported module
				if (!commandModule.default || typeof commandModule.default !== 'object') {
					logger.warn(`Skipping command file ${file}: Does not have a default export object.`);
					continue;
				}
				const command = commandModule.default;
				logger.info(`Command module properties: ${Object.keys(commandModule).join(', ')}`);
				logger.info(`Command default export keys: ${Object.keys(command).join(', ')}`);

				// Check for essential properties
				if ('data' in command && 'execute' in command) {
					client.commands.set(command.data.name, command);
					logger.info(`Loaded command: ${command.data.name}`);
				} else {
					logger.warn(`Skipping command file ${file}: Missing required "data" or "execute" property in default export.`);
				}
			} catch (error) {
				logger.error(`Error loading individual command file ${file}:`, error);
				// Decide if we should continue loading other commands or stop
				// For now, just log the error and continue
			}
		}
		logger.info(`Successfully loaded ${client.commands.size} commands`);
	} catch (error) {
		logger.error(`[CRITICAL] Failed to read commands directory or process command files:`, error);
		// This is likely fatal for startup
		throw error; // Re-throw to be caught by the main() catch block
	}
}

// Check if guilds exist in database and add if missing
async function checkGuildsForExisting() {
	logger.info(`[GUILD EXISTING] start...`);
	try {
		const guilds = await client.guilds.fetch();
		logger.info(`Checking ${guilds.size} guilds...`);
		
		let added = 0;
		for (const guild of guilds.values()) {
			if (!(await chatExists(guild.id))) {
				await insert(guild.id);
				logger.info(`[ADDED] ${guild.id} (${guild.name})`);
				added++;
			}
		}
		
		logger.info(`[GUILD EXISTING] complete. Added ${added} new guilds.`);
	} catch (error) {
		logger.error(`[GUILD EXISTING] Error checking guilds:`, error);
	}
}

// Helper function to efficiently check URL patterns
function isFilteredUrl(content) {
	// Check for common media/gif URLs to ignore
	if (content.startsWith(URL_PATTERNS.TENOR) || 
		content.startsWith(URL_PATTERNS.DISCORD_MEDIA)) {
		return true;
	}
	
	// Check for GIF extensions
	for (const pattern of URL_PATTERNS.GIF_EXTENSIONS) {
		if (content.includes(pattern)) {
			return true;
		}
	}
	
	// Check if it's any URL
	return content.includes('http') || isURL(content);
}

// Handle message processing separately for better organization
async function processMessage(message) {
	if (!message.guildId || message.author.bot) return;

	try {
		// Track message for analysis
		memoryManager.trackMessage(message);

		const content = message.content;
		const attachment = message.attachments.first();

		// Don't process URLs/media
		if (content && isFilteredUrl(content)) {
			return;
		}
		
		// Ensure guild is in database
		await insert(message.guildId);

		// Fetch chat settings and textbase
		const chat = await getChat(message.guildId);
		const textbase = chat.textbase;
		const count = textbase.length;

		// Manage database size
		if (count >= config.raw_limit) {
			await deleteFirst(message.guildId);
		}

		// Store message content if appropriate
		if (content && content.length > 0 && content.length <= MAX_MESSAGE_LENGTH) {
			await updateText(message.guildId, content);
		}

		// Store attachment URL if present
		if (attachment) {
			await updateText(message.guildId, attachment.url);
		}

		// Exit early if chat is disabled or no text to generate from
		if (chat.talk === 0 || textbase.length < 1) return;

		// Add current message to local textbase for generation
		if (content) {
			textbase.push(content);
		}

		// Determine if bot should reply (based on speed setting)
		const shouldReply = (() => {
			const integers = range(1, chat.speed);
			const randomNum = randomInteger(1, chat.speed);
			const chosenNum = choice(integers);
			return chosenNum === randomNum;
		})();
		
		if (shouldReply) {
			await generateAndSendReply(message.channelId, textbase, chat.gen);
		}
	} catch (error) {
		logger.error(`Error processing message in guild ${message.guildId}:`, error);
	}
}

// Generate and send a reply based on textbase
async function generateAndSendReply(channelId, textbase, genType) {
	try {
		const chain = new Markov(textbase.join(' '));
		const generatedText = (genType === 1) ? chain.generate_high(50) : chain.generate_low(50);
		
		if (!generatedText || generatedText === '') {
			return;
		}
		
		// Fix capitalization issues
		const correctedText = generatedText.replace(/\bHttps/g, 'https');
		
		const channel = client.channels.cache.get(channelId);
		if (!channel) {
			logger.warn(`Channel ${channelId} not found for sending message`);
			return;
		}
		
		// Check if Discord attachment URL is in the generated text
		const isLinkIncluded = correctedText.includes('https://cdn.discordapp.com');
		
		if (isLinkIncluded) {
			// Extract the link
			const linkMatch = correctedText.match(/(https?:\/\/[^\s]+)/g);
			if (!linkMatch || !linkMatch[0]) return;
			
			const link = linkMatch[0];
			const text = correctedText.replace(link, '').trim();
			
			try {
				// Verify the attachment URL is valid
				const response = await fetch(link, { method: 'HEAD' });
				
				if (response.ok) {
					await channel.send({
						content: text,
						files: [{ attachment: link }]
					}).catch(err => {
						logger.warn(`Failed to send message with attachment to ${channelId}:`, err.message);
					});
				} else {
					logger.debug(`Invalid attachment URL in generated text: ${link} (Status: ${response.status})`);
					// Send text without the invalid attachment
					await channel.send(text || correctedText).catch(err => {
						logger.warn(`Failed to send text-only message to ${channelId}:`, err.message);
					});
				}
			} catch (err) {
				logger.error(`Error validating attachment URL: ${link}`, err.message);
				// Fallback to just sending the text
				await channel.send(text || correctedText).catch(() => {});
			}
		} else {
			// Simple text reply
			await channel.send(correctedText).catch(err => {
				logger.warn(`Failed to send message to ${channelId}:`, err.message);
			});
		}
	} catch (error) {
		logger.error(`Error generating/sending reply to channel ${channelId}:`, error);
	}
}

// Set up event handlers
client.once(Events.ClientReady, async c => {
	try {
		logger.info(`Ready! Logged in as ${c.user.tag}`);
		logger.info(`Serving ${client.guilds.cache.size} guilds`);
		
		// Initialize and check guilds
		await checkGuildsForExisting();
		
		// Send heartbeats to shard manager if sharded
		if (client.shard) {
			// Signal to the shard manager that we're ready
			client.shard.send({ type: 'READY', id: client.shard.ids[0] });
			
			// Setup regular heartbeats
			setInterval(() => {
				try {
					client.shard.send('heartbeat');
				} catch (error) {
					logger.error(`Failed to send heartbeat:`, error);
				}
			}, 30000);
		}
	} catch (error) {
		logger.error(`Error in ready event:`, error);
	}
});

client.on(Events.InteractionCreate, async interaction => {
	// === LOG INTERACTION EARLY ===
	logger.info(`[InteractionCreate] Received interaction`, { 
		interactionId: interaction.id,
		type: interaction.type,
		commandName: interaction.commandName, 
		user: interaction.user?.tag || 'Unknown User', // Safer access
		guildId: interaction.guildId
	});

	// === Manual Inspection ===
	try {
		logger.info('[InteractionCreate] Inspecting interaction object properties:');
		logger.info(`  - interaction keys: ${Object.keys(interaction).join(', ')}`);
		logger.info(`  - interaction.options type: ${typeof interaction.options}`);
		if (interaction.options) {
			logger.info(`  - interaction.options keys: ${Object.keys(interaction.options).join(', ')}`);
			// Log raw data/options directly without stringify if possible
			console.log('  - interaction.options.data:', interaction.options.data); 
			console.log('  - interaction.options._hoistedOptions:', interaction.options._hoistedOptions);
		}
	} catch (inspectError) {
		logger.error('[InteractionCreate] Error during manual inspection:', inspectError);
	}
	// ===========================

	if (!interaction.isChatInputCommand()) {
		logger.debug('[InteractionCreate] Interaction is not ChatInputCommand, skipping.');
		return; 
	}

	logger.debug(`[InteractionCreate] Processing ChatInputCommand: ${interaction.commandName}`);
	const command = client.commands.get(interaction.commandName);
	
	if (!command) {
		logger.error(`No command matching ${interaction.commandName} was found.`, {
			commandName: interaction.commandName,
			guildId: interaction.guildId,
			userId: interaction.user.id
		});
		try {
			// Only reply if the interaction hasn't been replied to yet
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ 
					content: 'Sorry, that command is not available.', 
					ephemeral: true
				});
			}
		} catch (error) {
			logger.error(`Failed to reply to unknown command ${interaction.commandName}`, error);
		}
		return;
	}

	try {
		// Log command usage
		logger.command(
			interaction.commandName, 
			interaction.guildId, 
			interaction.user.id, 
			'started'
		);
		
		// Only defer if the command doesn't explicitly disable it AND the interaction hasn't been handled yet
		if (command.deferReply !== false && !interaction.replied && !interaction.deferred) {
			await interaction.deferReply({
				ephemeral: command.ephemeral ? true : undefined
			});
		}
		
		await command.execute(interaction);
		
		// Log successful execution
		logger.command(
			interaction.commandName, 
			interaction.guildId,
			interaction.user.id, 
			'completed'
		);
	} catch (error) {
		logger.error(`Error executing command ${interaction.commandName}`, {
			error,
			commandName: interaction.commandName,
			guildId: interaction.guildId,
			userId: interaction.user.id
		});
		
		try {
			const errorReply = { 
				content: 'An error occurred while executing this command.', 
				ephemeral: true
			};
			
			if (interaction.replied) {
				await interaction.followUp(errorReply);
			} else if (interaction.deferred) {
				await interaction.editReply(errorReply);
			} else {
				await interaction.reply(errorReply);
			}
			
			// Log the error response
			logger.command(
				interaction.commandName, 
				interaction.guildId,
				interaction.user.id, 
				'error_response_sent'
			);
		} catch (replyError) {
			logger.error(`Failed to send error response for ${interaction.commandName}`, {
				error: replyError,
				originalError: error,
				commandName: interaction.commandName,
				guildId: interaction.guildId,
				userId: interaction.user.id
			});
		}
	}
});

client.on(Events.GuildCreate, async guild => {
	logger.info(`Bot added to new guild: ${guild.name} (${guild.id})`);
	
	try {
		await insert(guild.id);
		
		// Find a suitable channel to send welcome message
		const channel = guild.channels.cache.find(channel =>
			channel.type === ChannelType.GuildText && 
			channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
		);
		
		if (channel) {
			await channel.send({
				content: `Hi **${guild.name}**!\nThanks for inviting me, I'm **Neurobalbes** and I remember your messages to generate my own.\n\nFor my commands, type \`/help\`\nTo change the bot language, type \`/language\``
			}).catch(err => logger.warn(`Could not send welcome message:`, err.message));
		}
	} catch (error) {
		logger.error(`Error initializing data for new guild ${guild.id}:`, error);
		
		const channel = guild.channels.cache.find(channel =>
			channel.type === ChannelType.GuildText && 
			channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
		);
		
		if (channel) {
			await channel.send({
				content: `Error! I can't add your server to the database. Please kick and re-invite me to fix this.`
			}).catch(() => {});
		}
	}
});

// Use processMessage for message handling
client.on(Events.MessageCreate, processMessage);

// Improved error handling
client.on(Events.Error, error => {
	logger.error(`Client error:`, error);
	connectionManager.handleDisconnect(client, error);
});

client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
	logger.warn(`Shard ${shardId} disconnected with code ${closeEvent.code}:`, closeEvent.reason);
	connectionManager.handleDisconnect(client, new Error(`Shard ${shardId} disconnected: ${closeEvent.reason}`));
});

client.on(Events.ShardError, (error, shardId) => {
	logger.error(`Shard ${shardId} error:`, error);
	// Don't disconnect for shard errors, they might be transient
});

// Handle uncaught exceptions more gracefully
process.on('uncaughtException', error => {
	logger.error(`Uncaught exception:`, error);
	// Don't exit for all uncaught exceptions, only critical ones
	if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
		logger.info(`Recovered error, continuing execution...`);
	} else {
		logger.error(`Critical error, exiting in 5 seconds...`);
		
		// Try to send a message to the shard manager so it knows this was a clean exit
		if (client.shard) {
			try {
				client.shard.send({ type: 'FATAL_ERROR', error: error.message });
			} catch (e) {
				// Ignore errors when trying to send this message
			}
		}
		
		setTimeout(() => process.exit(1), 5000);
	}
});

// Log warning/debug messages in non-production environments
if (process.env.NODE_ENV !== 'production') {
	client.on(Events.Debug, info => logger.debug(`[DEBUG] ${info}`));
	client.on(Events.Warn, info => logger.warn(`[WARN] ${info}`));
}

// Start everything
async function main() {
	try {
		// Set up process-wide exception handling for promises
		process.on('unhandledRejection', (error) => {
			logger.error(`Unhandled promise rejection:`, error);
			// Consider if crashing is appropriate for some rejection types
		});

		// Add top-level exception handler for synchronous errors during startup
		process.on('uncaughtException', (error, origin) => {
			logger.error(`[CRITICAL] Uncaught exception during startup or runtime:`, error);
			logger.error(`Origin: ${origin}`);
			// Decide if process should exit based on error type or origin
			// For now, log critically and let existing logic handle exit if needed
		});

		logger.info('Starting main initialization...');

		// Load commands first
		logger.info('Loading commands...');
		await loadCommands();
		logger.info('Command loading complete.');

		// Validate token before attempting login
		if (!config.token || config.token === 'YOUR_TOKEN_HERE') {
			logger.error(`Invalid bot token configuration. Check your config.json or environment variables.`);
			process.exit(1); // Exit immediately for invalid token
		}

		// Then login with better error handling
		logger.info(`Attempting to log in to Discord...`);
		await client.login(config.token);
		logger.info(`Successfully logged in! Waiting for client to be ready...`);

		// Set a timeout to exit if the ready event never fires
		const readyTimeout = setTimeout(() => {
			logger.error(`Client did not become ready within timeout period (4 minutes). Exiting.`);
			process.exit(1);
		}, 240000); // 4 minutes

		// Clear the timeout when ready event fires
		client.once(Events.ClientReady, () => {
			clearTimeout(readyTimeout);
			logger.info('Client is ready!');
			// Put any post-ready initialization here if needed
		});

		logger.info('Main initialization sequence complete, event handlers are active.');

	} catch (error) {
		logger.error(`[CRITICAL] Failed to initialize bot in main function:`, error);
		// Attempt to send error to shard manager before exiting
		if (client.shard) {
			try {
				client.shard.send({ type: 'INITIALIZATION_FAILED', error: error.message });
			} catch (sendError) {
				logger.error('Failed to send initialization failure to shard manager', sendError);
			}
		}
		process.exit(1); // Exit on any initialization error in main
	}
}

main();

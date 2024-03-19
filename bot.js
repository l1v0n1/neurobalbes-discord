const { Client, Events, GatewayIntentBits, Collection, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const { token, bot_description, raw_limit } = require('./config.json');
const { isURL, choice, randomInteger, range } = require('./functions');
const { getChat, updateText, insert, chatExists, deleteFirst } = require('./database');
const Markov = require('./markov');

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
	presence: {
		activities: [{
			type: 0,
			name: bot_description
		}]
	}
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	try {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	} catch (error) {
		console.error(`Error loading command file: ${file}`);
		console.error(error);
	}
}

async function checkGuildsForExisting() {
	console.log('[GUILD EXISTING] start...');
	const guilds = await client.guilds.fetch();
	for (const guild of guilds.values()) {
		if (!(await chatExists(guild.id))) {
			await insert(guild.id);
			console.log('[ADDED]', guild.id);
		}
	}
	console.log('[GUILD EXISTING] stop.');
}

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.editReply({ content: 'Error... Try again..', ephemeral: true }).catch(console.error);
	}
});

client.on(Events.GuildCreate, async guild => {
	const channel = guild.channels.cache.find(channel =>
		channel.type === ChannelType.GuildText && channel.permissionsFor(guild.members.me)
		.has(PermissionsBitField.Flags.SendMessages));

	try {
		await insert(guild.id);
	} catch (e) {
		console.log("Ошибка при инвайте", e);
		await channel.send(`Error! I can't add your server to the database. Please kick and re-invite me to fix this.`);
	} finally {
		await channel.send(`Hi **${guild.name}**!\nThanks for inviting me, I'm **Neurobalbes** and I remember your messages to generate my own.\n\nFor my commands, type \`/help\`\nTo change the bot language, type \`/language\``).catch(() => {/* Ignore error */});
	}
});

client.on(Events.MessageCreate, async message => {
	if (!message.guildId || message.author.bot) return;

	const attachment = message.attachments.first();

	const isTenorLink = message.content.startsWith("https://tenor.com/view");
	const isDiscordLink = message.content.startsWith("https://media.discordapp.net/")
	const isGif = message.content.includes(".gif") ||  message.content.includes("-gif")
	const containsHttp = message.content.includes("http");
	const isMessageUrl = isURL(message.content);
	
	if (isTenorLink || isDiscordLink || isGif) {
	  // Игнорировать
	} else if (containsHttp || isMessageUrl) {
	  return;
	}
	
	await insert(message.guildId);

	let chat = await getChat(message.guildId);
	let textbase = chat.textbase;
	let count = textbase.length;

	if (count >= raw_limit) await deleteFirst(message.guildId);

	if (message.content.length > 0 && message.content.length <= 1000 && count <= raw_limit) {
		await updateText(message.guildId, message.content);
	}

	if (attachment) {
		await updateText(message.guildId, attachment.url);
	}

	if (chat.talk === 0 || textbase.length < 1) return;

	chat.textbase.push(message.content);

	const integers = range(1, chat.speed);
	const randoms = randomInteger(1, chat.speed);
	const x = choice(integers);
	
	if (x === randoms) {
	  const chain = new Markov(textbase.join(' '));
	  const generated_text = (chat.gen === 1) ? chain.generate_high(50) : chain.generate_low(50);
	
	  if (!generated_text || generated_text === '') {
		return;
	  }
	
	  const correctedText = generated_text.replace('Https', 'https');
	
	  const channel = client.channels.cache.get(message.channelId);
	  const isLinkIncluded = correctedText.includes('https://cdn.discordapp.com');
	
	  if (isLinkIncluded) {
		const link = correctedText.match(/(https?:\/\/[^\s]+)/g);
		const text = correctedText.replace(link[0], '');
		try {
			const response = await fetch(link[0]);
			if (response.status === 200) {
				await channel.send({
					content: text,
					files: [{
						attachment: link[0]
					}]
				}).catch(() => {
					// Игнорировать
				  });
			} else {
				console.log("Ссылка не существует:", link[0]);
			}
		} catch (err) {
			console.error(err);
		}
	  } else {
		await channel.send(correctedText).catch(() => {
		  // Игнорировать
		});
	  }
	}
	
});

client.on('debug', console.log);
client.on('warn', console.log);


client.login(token);

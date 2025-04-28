import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Configuration Loading ---
// Load clientId and token from config.json
// Using dynamic import for ES modules
let config = {
	token: process.env.BOT_TOKEN,
	clientId: process.env.CLIENT_ID,
};

try {
	// Adjust path relative to deploy-commands.js
	const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'config.json');
	const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	config = { ...config, ...userConfig };
	console.log('Configuration loaded from config.json');
} catch (error) {
	console.warn(`Could not load config.json, attempting environment variables. Error: ${error.message}`);
}

const clientId = config.clientId;
const token = config.token;

if (!clientId || !token || token === 'YOUR_BOT_TOKEN_HERE' || clientId === 'YOUR_CLIENT_ID_HERE') {
	console.error('Error: clientId or token is missing or not set in config.json or environment variables.');
	console.error('Please ensure config.json exists and contains valid \'clientId\' and \'token\'.');
	process.exit(1);
}
// --------------------------

const commands = [];
// Grab all the command files from the commands directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, 'commands');

console.log(`Reading command files from: ${commandsPath}`);

async function loadCommands() {
	try {
		const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const fileUrl = new URL(`file://${filePath.replace(/\\/g, '/')}`); // Ensure proper file URL format
			console.log(` -> Loading ${file}...`);
			try {
				const commandModule = await import(fileUrl.href);
				if (commandModule.default && commandModule.default.data) {
					const commandData = typeof commandModule.default.data.toJSON === 'function'
						? commandModule.default.data.toJSON()
						: commandModule.default.data;
					
					// Basic validation of command data structure
					if (commandData.name && commandData.description) {
						 commands.push(commandData);
						 console.log(`   + Added command: ${commandData.name}`);
					} else {
						console.warn(`   ! Skipping ${file}: Exported data is missing name or description.`);
					}
				} else {
					console.warn(`   ! Skipping ${file}: Missing 'default' export or 'data' property.`);
				}
			} catch (importError) {
				console.error(`   X Error loading ${file}:`, importError);
			}
		}
	} catch (readDirError) {
		console.error(`Error reading commands directory at ${commandsPath}:`, readDirError);
		process.exit(1);
	}
}

async function deploy() {
	await loadCommands(); // Wait for commands to be loaded

	if (commands.length === 0) {
		console.log('No valid commands found to deploy.');
		return;
	}

	// Construct and prepare an instance of the REST module
	const rest = new REST({ version: '10' }).setToken(token);

	// Deploy the commands
	try {
		console.log(`
Started refreshing ${commands.length} application (/) commands globally.`);

		// The put method is used to fully refresh all commands
		const data = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
	} catch (error) {
		console.error('\nError deploying commands:');
		console.error(error);
	}
}

deploy(); // Execute the deployment function 
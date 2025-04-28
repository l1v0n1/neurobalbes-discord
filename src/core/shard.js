import { ShardingManager } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs'; // Needed for config loading

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration Loading ---
let config = {
    token: process.env.BOT_TOKEN,
    totalShards: 'auto' // Default to auto sharding
};

try {
    const configPath = path.resolve(__dirname, '../../config.json');
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Only override token and totalShards if present in config
    if (userConfig.token) config.token = userConfig.token;
    if (userConfig.shardCount) config.totalShards = userConfig.shardCount; 
    console.log('Configuration loaded from config.json');
} catch (error) {
    console.warn(`Could not load config.json, attempting environment variables. Error: ${error.message}`);
}

const token = config.token;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    console.error('Error: token is missing or not set in config.json or environment variables.');
    process.exit(1);
}
// --------------------------

// Define the path to your main bot file
const botPath = path.join(__dirname, 'bot.js');
console.log(`Main bot script path: ${botPath}`);

// Create your ShardingManager instance
const manager = new ShardingManager(botPath, {
    token: token, // Pass the token
    totalShards: config.totalShards, // Use 'auto' or the value from config
    respawn: true, // Automatically respawn shards that die
    execArgv: ['--max-old-space-size=4096', '--trace-warnings'] // Pass memory limit and trace flag to shards
    // Add other ShardingManager options here if needed, e.g.:
    // shardArgs: ['--some-node-flag'],
});

console.log(`Attempting to spawn shards with totalShards set to: ${config.totalShards}`);

// Emitted when a shard is created
manager.on('shardCreate', (shard) => {
    console.log(`[ShardManager] Launched shard ${shard.id}`);

    // Optional: Add basic event listeners to the shard from the manager
    shard.on('ready', () => {
        console.log(`[Shard ${shard.id}] Reported Ready`);
    });
    shard.on('disconnect', () => {
        console.warn(`[Shard ${shard.id}] Reported Disconnect`);
        // Default ShardingManager should handle respawn if enabled
    });
    shard.on('reconnecting', () => {
        console.log(`[Shard ${shard.id}] Reported Reconnecting`);
    });
     shard.on('death', (process) => {
        console.error(`[Shard ${shard.id}] Reported Death. Exit code: ${process.exitCode}, Signal: ${process.signalCode}`);
        // Default ShardingManager should handle respawn if enabled
    });
    shard.on('error', (error) => {
         console.error(`[Shard ${shard.id}] Reported Error:`, error);
    });
});

// Spawn your shards
manager.spawn({ delay: 15000, timeout: 90000 }) // Add delay (15s) and longer timeout (90s)
    .then(() => {
        console.log('[ShardManager] All shards spawned successfully.');
    })
    .catch((error) => {
        console.error('[ShardManager] Error spawning shards:', error);
        process.exit(1); // Exit if spawning fails
    });

// Optional: Basic process signal handling for graceful shutdown
let shuttingDown = false;
async function gracefulShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[ShardManager] Received shutdown signal. Destroying all shards...');
    // The default manager doesn't have a specific graceful shutdown method
    // Killing the manager process should signal shards to terminate
    // manager.broadcastEval(client => client.destroy()); // This might be needed depending on bot logic
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

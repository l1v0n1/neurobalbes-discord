import { ShardingManager } from 'discord.js';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safer config loading with defaults and fallbacks
let config = {
    token: process.env.BOT_TOKEN,
    shardCount: 'auto',
    shardArgs: ['--max-old-space-size=2048']
};

try {
    const userConfig = await import('../../config.json', { with: { type: 'json' } });
    config = { ...config, ...userConfig.default };
} catch (error) {
    console.warn('Could not load config.json, using defaults and environment variables:', error.message);
}

// Calculate appropriate memory allocation based on system specs
function calculateMemoryLimit() {
    const totalMemory = Math.floor(os.totalmem() / (1024 * 1024 * 1024)); // Convert to GB
    const freeMemory = Math.floor(os.freemem() / (1024 * 1024 * 1024)); // Convert to GB
    
    console.log(`System memory: ${totalMemory}GB total, ${freeMemory}GB free`);
    
    // Allocate memory based on available system resources
    // Leave at least 1GB for the system
    const perShardMemory = Math.max(1, Math.min(2, Math.floor((freeMemory - 1) / 2)));
    
    return `--max-old-space-size=${perShardMemory * 1024}`;
}

class CustomShardingManager extends ShardingManager {
    constructor(file, options) {
        super(file, options);
        this.status = new Map();
        this.statsInterval = null;
        this.monitorInterval = null;
        this.resetInterval = null;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.on('shardCreate', shard => {
            console.log(`[Shard Manager] Launched shard ${shard.id}`);
            this.status.set(shard.id, {
                status: 'starting',
                lastHeartbeat: Date.now(),
                restarts: 0,
                memory: null,
                uptime: 0,
                guilds: 0
            });

            // Handle shard specific events
            shard.on('ready', () => {
                console.log(`[Shard ${shard.id}] Ready`);
                this.status.get(shard.id).status = 'ready';
                
                // Collect initial stats
                this.updateShardStats(shard);
            });

            shard.on('disconnect', () => {
                console.log(`[Shard ${shard.id}] Disconnected`);
                this.status.get(shard.id).status = 'disconnected';
                this.handleShardDisconnect(shard);
            });

            shard.on('death', (processError) => {
                const exitCode = processError ? processError.exitCode : null;
                console.log(`[Shard ${shard.id}] Died${exitCode ? ` with exit code ${exitCode}` : ''}`);
                this.status.get(shard.id).status = 'dead';
                this.handleShardDeath(shard, processError);
            });

            // Setup heartbeat monitoring
            shard.on('message', message => {
                if (message === 'heartbeat') {
                    this.status.get(shard.id).lastHeartbeat = Date.now();
                } else if (typeof message === 'object' && message !== null) {
                    // Handle stats messages
                    if (message.type === 'stats') {
                        const shardStatus = this.status.get(shard.id);
                        if (shardStatus) {
                            shardStatus.memory = message.memory;
                            shardStatus.uptime = message.uptime;
                            shardStatus.guilds = message.guilds;
                        }
                    }
                    // Handle ready message
                    else if (message.type === 'READY') {
                        console.log(`[Shard ${shard.id}] Ready message received directly from shard`);
                        const status = this.status.get(shard.id);
                        if (status) {
                            status.status = 'ready';
                            status.lastHeartbeat = Date.now();
                        }
                    }
                    // Handle fatal error message
                    else if (message.type === 'FATAL_ERROR') {
                        console.error(`[Shard ${shard.id}] Fatal error received: ${message.error}`);
                        const status = this.status.get(shard.id);
                        if (status) {
                            status.status = 'error';
                            status.lastError = message.error;
                        }
                        
                        // Don't immediately restart on fatal errors, 
                        // wait for the process to exit naturally
                    }
                }
            });
        });
    }

    async updateShardStats(shard) {
        try {
            // Request memory and guild stats from the shard
            const memoryUsage = await shard.eval('process.memoryUsage()');
            const guildCount = await shard.eval('this.guilds.cache.size');
            const uptime = await shard.eval('this.uptime');
            
            const status = this.status.get(shard.id);
            if (status) {
                status.memory = {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024),
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
                };
                status.guilds = guildCount;
                status.uptime = uptime;
            }
        } catch (error) {
            console.error(`[Shard ${shard.id}] Failed to update stats:`, error.message);
        }
    }

    async handleShardDisconnect(shard) {
        const status = this.status.get(shard.id);
        if (!status) return;
        
        if (status.restarts < 5) {
            console.log(`[Shard ${shard.id}] Attempting reconnection (${status.restarts + 1}/5)...`);
            status.restarts++;
            
            // Exponential backoff
            const backoffTime = 5000 * Math.pow(1.5, status.restarts - 1);
            console.log(`[Shard ${shard.id}] Waiting ${backoffTime/1000} seconds before reconnecting`);
            
            try {
                setTimeout(async () => {
                    try {
                        await shard.respawn({ delay: 1000 });
                        console.log(`[Shard ${shard.id}] Successfully respawned`);
                    } catch (innerError) {
                        console.error(`[Shard ${shard.id}] Failed inner respawn:`, innerError);
                    }
                }, backoffTime);
            } catch (error) {
                console.error(`[Shard ${shard.id}] Failed to respawn:`, error);
            }
        } else {
            console.error(`[Shard ${shard.id}] Too many restart attempts, manual intervention required`);
        }
    }

    async handleShardDeath(shard, processError) {
        const status = this.status.get(shard.id);
        if (!status) return;
        
        // Log the error details
        if (processError) {
            console.error(`[Shard ${shard.id}] Death error details:`, processError);
        }
        
        if (status.restarts < 5) {
            console.log(`[Shard ${shard.id}] Attempting resurrection (${status.restarts + 1}/5)...`);
            status.restarts++;
            
            // Increasing delay based on restart attempts
            const delay = 5000 + (status.restarts * 3000);
            
            try {
                setTimeout(async () => {
                    try {
                        // Before respawning, make sure any previous process is fully cleaned up
                        try {
                            await shard.kill({ force: true });
                            console.log(`[Shard ${shard.id}] Successfully killed previous shard process`);
                        } catch (killError) {
                            // Ignore kill errors, process might already be gone
                        }
                        
                        // Clear existing listeners to prevent memory leaks
                        shard.removeAllListeners('ready');
                        shard.removeAllListeners('disconnect');
                        shard.removeAllListeners('death');
                        
                        // Then respawn with increased timeout
                        await shard.respawn({ 
                            delay: 1000,
                            timeout: 300000 // 5 minutes timeout, same as initial spawn
                        });
                        console.log(`[Shard ${shard.id}] Successfully resurrected`);
                    } catch (innerError) {
                        console.error(`[Shard ${shard.id}] Failed inner resurrection:`, innerError);
                        
                        // If we hit the ShardingReadyDied error, try one more time with a clean spawn
                        if (innerError.code === 'ShardingReadyDied' && !status._cleanSpawnAttempted) {
                            status._cleanSpawnAttempted = true;
                            console.log(`[Shard ${shard.id}] Attempting a clean spawn after receiving ShardingReadyDied`);
                            
                            try {
                                // Create a completely new shard with the same ID
                                // This avoids potential issues with the old shard instance
                                const newShard = this.createShard(shard.id);
                                await newShard.spawn({ timeout: 300000 });
                                console.log(`[Shard ${shard.id}] Clean spawn successful`);
                            } catch (newSpawnError) {
                                console.error(`[Shard ${shard.id}] Clean spawn failed:`, newSpawnError);
                            }
                        }
                    }
                }, delay);
            } catch (error) {
                console.error(`[Shard ${shard.id}] Failed to resurrect:`, error);
            }
        } else {
            console.error(`[Shard ${shard.id}] Shard died too many times, manual intervention required`);
        }
    }

    startMonitoring() {
        // Stop any existing monitoring
        this.stopMonitoring();
        
        // Monitor shard health every minute
        this.monitorInterval = setInterval(() => {
            const now = Date.now();
            this.status.forEach((status, shardId) => {
                if (status.status === 'ready' && now - status.lastHeartbeat > 60000) {
                    console.warn(`[Shard ${shardId}] No heartbeat received in 60s, investigating...`);
                    
                    const shard = this.shards.get(shardId);
                    if (!shard) {
                        console.error(`[Shard ${shardId}] Shard instance not found`);
                        return;
                    }
                    
                    shard.eval('this.ws.ping')
                        .then(ping => {
                            if (ping === -1) {
                                console.error(`[Shard ${shardId}] Connection appears dead, attempting restart`);
                                this.handleShardDisconnect(shard);
                            } else {
                                console.log(`[Shard ${shardId}] Ping check passed: ${ping}ms`);
                            }
                        })
                        .catch(error => {
                            console.error(`[Shard ${shardId}] Failed to check ping:`, error);
                            
                            // If we can't evaluate code, the shard is likely dead
                            if (error.message.includes('Cannot read properties of null') || 
                                error.message.includes('Not connected to worker')) {
                                console.error(`[Shard ${shardId}] Shard appears to be dead, attempting resurrection`);
                                this.handleShardDeath(shard, { message: 'Failed ping check' });
                            }
                        });
                }
            });
        }, 60000);

        // Reset restart counters every 6 hours if shard is stable
        this.resetInterval = setInterval(() => {
            this.status.forEach(status => {
                if (status.status === 'ready' && Date.now() - status.lastHeartbeat < 300000) {
                    if (status.restarts > 0) {
                        console.log(`Resetting restart counter for shard with id ${status.id} (was ${status.restarts})`);
                        status.restarts = 0;
                    }
                }
            });
        }, 6 * 60 * 60 * 1000); // 6 hours
        
        // Log stats every 5 minutes
        this.statsInterval = setInterval(() => {
            this.logStats();
        }, 5 * 60 * 1000);
    }
    
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
            this.resetInterval = null;
        }
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }
    
    logStats() {
        const totalGuilds = Array.from(this.status.values())
            .reduce((sum, status) => sum + (status.guilds || 0), 0);
            
        const totalMemory = Array.from(this.status.values())
            .reduce((sum, status) => sum + (status.memory?.rss || 0), 0);
            
        const statuses = {};
        this.status.forEach((status, id) => {
            if (!statuses[status.status]) statuses[status.status] = 0;
            statuses[status.status]++;
        });
        
        console.log(`[Stats] Shards: ${this.shards.size}, Guilds: ${totalGuilds}, Memory: ${totalMemory}MB`);
        console.log(`[Stats] Shard statuses: ${JSON.stringify(statuses)}`);
        
        // Individual shard stats
        console.log('[Stats] Detailed shard information:');
        this.status.forEach((status, id) => {
            if (status.memory) {
                console.log(`[Stats] Shard ${id}: ${status.status}, ${status.guilds} guilds, ${status.memory.rss}MB RAM, uptime: ${Math.floor(status.uptime / 60000)}m`);
            } else {
                console.log(`[Stats] Shard ${id}: ${status.status}, guilds unknown, memory unknown`);
            }
        });
    }
    
    async updateAllShardStats() {
        for (const [id, shard] of this.shards) {
            await this.updateShardStats(shard).catch(error => {
                console.error(`[Shard ${id}] Failed to update stats:`, error);
            });
        }
    }
    
    async gracefulShutdown() {
        console.log('Gracefully shutting down shards...');
        
        // Stop monitoring to prevent restarts during shutdown
        this.stopMonitoring();
        
        const shutdownPromises = [];
        
        for (const [id, shard] of this.shards) {
            shutdownPromises.push(
                shard.eval('this.destroy()')
                    .then(() => console.log(`Shard ${id} shutdown complete`))
                    .catch(error => console.error(`Error shutting down shard ${id}:`, error))
            );
        }
        
        await Promise.allSettled(shutdownPromises);
        console.log('All shards shutdown complete');
    }
}

// Calculate optimal number of shards based on guild count
async function calculateShardCount() {
    try {
        // Check if the shardCount is explicitly set in config
        if (config.shardCount && config.shardCount !== 'auto') {
            return parseInt(config.shardCount, 10);
        }
        
        // For large bots, Discord now requires sharding automatically
        // So let's default to a sensible number instead of creating a temporary client
        console.log('Bot is likely large enough to require sharding. Using 2 shards by default.');
        // You can adjust this number based on your bot's needs
        return 2;
    } catch (error) {
        console.error('Failed to calculate shard count:', error);
        return 1; // Default to 1 shard if calculation fails
    }
}

async function startSharding() {
    try {
        console.log('Starting sharding process...');
        
        // Calculate optimal memory limit if not specified
        let shardArgs = config.shardArgs;
        if (!shardArgs || !shardArgs.some(arg => arg.includes('--max-old-space-size'))) {
            const memoryLimit = calculateMemoryLimit();
            shardArgs = shardArgs || [];
            shardArgs.push(memoryLimit);
        }
        
        // Calculate shard count
        const shardCount = await calculateShardCount();
        console.log(`Starting bot with ${shardCount} shard(s)...`);
        console.log(`Using Node.js args: ${shardArgs.join(' ')}`);

        // Get absolute path to bot.js
        const botPath = path.join(__dirname, 'bot.js');
        console.log(`Bot script path: ${botPath}`);

        const manager = new CustomShardingManager(botPath, {
            token: config.token,
            totalShards: shardCount,
            respawn: true,
            timeout: 300000, // Increased from 60000 to 300000 (5 minutes)
            execArgv: shardArgs
        });

        // Add rate limit protection
        setupRateLimitProtection(manager);

        // Start monitoring
        manager.startMonitoring();
        
        // Spawn shards
        console.log('Spawning shards...');
        await manager.spawn({
            delay: 7500, // 7.5 seconds delay between shard spawns
            timeout: 300000 // Increased from 60000 to 300000 (5 minutes)
        }).catch(error => {
            console.error('Error during shard spawn:', error);
            
            // Try to provide more helpful diagnostics
            if (error.code === 'ShardingReadyTimeout') {
                console.log('Shard ready timeout. This could be due to:');
                console.log('1. Network connectivity issues');
                console.log('2. Authentication problems with the Discord API');
                console.log('3. High server load or rate limiting');
                console.log('4. Errors in the client initialization code');
                
                // Check if token is properly configured
                if (!config.token || config.token === 'YOUR_TOKEN_HERE') {
                    console.error('ERROR: Invalid bot token configuration');
                }
            }
            
            throw error;
        });
        
        console.log('All shards spawned successfully');
        
        // Update all shard stats after 30 seconds to let them initialize
        setTimeout(async () => {
            await manager.updateAllShardStats();
            manager.logStats();
        }, 30000);
        
        // Handle process termination
        setupShutdownHandlers(manager);

    } catch (error) {
        console.error('Failed to start sharding:', error);
        process.exit(1);
    }
}

function setupShutdownHandlers(manager) {
    let shuttingDown = false;
    
    async function shutdown() {
        if (shuttingDown) return;
        shuttingDown = true;
        
        console.log('Received shutdown signal. Starting graceful shutdown...');
        
        try {
            await manager.gracefulShutdown();
            console.log('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }
    
    // Handle different termination signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // For Nodemon restart
    
    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
        console.error('Uncaught exception in shard manager:', error);
        
        // Fast check for I/O errors without complex operations
        if (error.code === 'EIO' || error.message.includes('write EIO')) {
            console.error('I/O Error detected, attempting recovery...');
            // Don't exit - let the process continue
            return;
        }
        
        // For other errors, proceed with normal shutdown
        shutdown().catch(() => process.exit(1));
    });
}

// Add rate limiting protection for API calls - optimized version
function setupRateLimitProtection(manager) {
    // Lightweight rate limiting that only applies during high traffic periods
    let apiCallCounter = 0;
    let lastResetTime = Date.now();
    const MAX_CALLS_PER_MINUTE = 100;
    const RATE_LIMIT_RESET_INTERVAL = 60000; // 1 minute
    
    // More efficient rate limit check without an interval
    const checkRateLimit = () => {
        const now = Date.now();
        // Reset counter if minute has passed
        if (now - lastResetTime > RATE_LIMIT_RESET_INTERVAL) {
            apiCallCounter = 0;
            lastResetTime = now;
            return false;
        }
        
        return apiCallCounter > MAX_CALLS_PER_MINUTE;
    };
    
    // Only patch spawn method, which is called infrequently
    const origSpawn = manager.spawn;
    manager.spawn = async function(...args) {
        apiCallCounter += 3; // Less aggressive counting
        
        if (checkRateLimit()) {
            console.warn('Rate limit prevention triggered - delaying shard spawn');
            // Wait enough time for the rate limit to reset
            const timeToWait = RATE_LIMIT_RESET_INTERVAL - (Date.now() - lastResetTime);
            await new Promise(resolve => setTimeout(resolve, timeToWait + 1000));
            apiCallCounter = 0;
            lastResetTime = Date.now();
        }
        
        return origSpawn.apply(this, args);
    };
}

// Start the sharding process
startSharding();

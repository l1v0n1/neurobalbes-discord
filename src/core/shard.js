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
    shardArgs: ['--max-old-space-size=4096']
};

try {
    const userConfig = await import('../../config.json', { with: { type: 'json' } });
    config = { ...config, ...userConfig.default };
} catch (error) {
    console.warn('Could not load config.json, using defaults and environment variables:', error.message);
}

// Calculate appropriate memory allocation based on system specs
function calculateMemoryLimit(numShards) {
    const totalMemoryGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
    const freeMemoryGB = Math.floor(os.freemem() / (1024 * 1024 * 1024));
    
    console.log(`System memory: ${totalMemoryGB}GB total, ${freeMemoryGB}GB free`);
    
    // Default to 4GB per shard if calculation fails or not enough free memory
    const baseMemoryMB = 4096;
    let perShardMemoryMB = baseMemoryMB;

    // Try to calculate based on free memory, leaving ~2GB for OS/other processes
    if (freeMemoryGB > 4 && numShards > 0) { 
        const availableForShardsMB = (freeMemoryGB - 2) * 1024;
        const calculatedMB = Math.floor(availableForShardsMB / numShards);
        // Use calculated value if it's reasonable (between 2GB and 8GB), otherwise stick to base
        if (calculatedMB >= 2048 && calculatedMB <= 8192) {
             perShardMemoryMB = calculatedMB;
        } else if (calculatedMB < 2048) {
             perShardMemoryMB = 2048; // Minimum 2GB if calculation is too low
        }
        // If calculation is > 8GB, stick to base unless overridden in config
    } else if (freeMemoryGB <= 4) {
        // Not much free RAM, force minimum reasonable value
        perShardMemoryMB = 2048; 
    }

    console.log(`Calculated memory per shard: ${perShardMemoryMB}MB`);
    return `--max-old-space-size=${perShardMemoryMB}`;
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
        if (!status) {
            console.warn(`[Shard ${shard.id}] Status not found during handleShardDeath.`);
            return;
        }

        // Log the error details
        if (processError) {
            console.error(`[Shard ${shard.id}] Death detected. Error details:`, processError);
        } else {
            console.warn(`[Shard ${shard.id}] Death detected with no processError object.`);
        }

        // Increment restart counter only if below limit
        if (status.restarts < 5) {
            status.restarts++;
            console.log(`[Shard ${shard.id}] Attempting resurrection (${status.restarts}/5)...`);

            // Increasing delay based on restart attempts
            const delay = 5000 + (status.restarts * 3000);
            console.log(`[Shard ${shard.id}] Waiting ${delay / 1000} seconds before respawn attempt.`);

            setTimeout(async () => {
                console.log(`[Shard ${shard.id}] Initiating respawn...`);
                try {
                    // Safer listener removal
                    try {
                        shard.removeAllListeners(); // Remove all listeners to be safe
                        console.log(`[Shard ${shard.id}] Removed listeners from old shard instance.`);
                    } catch (listenerError) {
                        console.error(`[Shard ${shard.id}] Error removing listeners:`, listenerError);
                        // Continue anyway, the old shard instance might be unusable
                    }

                    // Respawn with increased timeout
                    await shard.respawn({ 
                        delay: 1000,
                        timeout: 300000 // 5 minutes timeout
                    });
                    console.log(`[Shard ${shard.id}] Respawn command issued successfully.`);
                    // Reset clean spawn flag if respawn is attempted
                    status._cleanSpawnAttempted = false; 
                } catch (respawnError) {
                    console.error(`[Shard ${shard.id}] Respawn attempt failed:`, respawnError);
                    // Consider adding logic here if respawn fails repeatedly
                }
            }, delay);

        } else {
            console.error(`[Shard ${shard.id}] Shard died too many times (${status.restarts} attempts). Manual intervention required. Stopping automatic respawn.`);
            // Optionally notify an admin or take other actions
        }
    }

    startMonitoring() {
        // Stop any existing monitoring
        this.stopMonitoring();
        
        console.log('[Shard Manager] Starting health monitoring...');
        // Monitor shard health every minute
        this.monitorInterval = setInterval(() => {
            const now = Date.now();
            this.status.forEach((status, shardId) => {
                // Only monitor shards that are supposed to be ready
                if (status.status === 'ready') { 
                    if (now - status.lastHeartbeat > 90000) { // Increased grace period to 90s
                        console.warn(`[Shard ${shardId}] No heartbeat received in 90s, investigating...`);
                        
                        const shard = this.shards.get(shardId);
                        if (!shard) {
                            console.error(`[Shard ${shardId}] Shard instance not found during monitoring check.`);
                            // Update status if shard is missing
                            if (status.status !== 'dead') {
                                status.status = 'missing';
                                this.handleShardDeath(shard, { message: 'Shard instance missing' });
                            }
                            return;
                        }
                        
                        // Check shard process connectivity first
                        if (!shard.process?.connected) {
                            console.error(`[Shard ${shardId}] Process is not connected. Assuming dead.`);
                            this.handleShardDeath(shard, { message: 'Process not connected' });
                            return;
                        }
                        
                        // Try evaluating ping
                        console.log(`[Shard ${shardId}] Evaluating ping...`);
                        shard.eval('this.ws.ping')
                            .then(ping => {
                                console.log(`[Shard ${shardId}] Ping result: ${ping}`);
                                if (ping === -1) {
                                    console.error(`[Shard ${shardId}] Ping returned -1, connection appears dead. Restarting.`);
                                    // Don't call handleShardDisconnect, go straight to death handler
                                    this.handleShardDeath(shard, { message: 'Ping returned -1' });
                                } else {
                                    // If ping is okay, maybe the heartbeat message got lost?
                                    console.warn(`[Shard ${shardId}] Ping is okay (${ping}ms), but heartbeat is missing. Monitoring.`);
                                    // Optionally, try sending a ping request *to* the shard?
                                }
                            })
                            .catch(error => {
                                console.error(`[Shard ${shardId}] Failed ping evaluation:`, error);
                                
                                // If evaluation fails, shard/IPC is likely dead
                                console.error(`[Shard ${shardId}] Assuming shard is dead due to ping evaluation failure.`);
                                this.handleShardDeath(shard, { message: 'Ping evaluation failed', error: error.message });
                            });
                    }
                }
            });
        }, 60000); // Check every 60 seconds

        // Reset restart counters every 6 hours if shard is stable
        this.resetInterval = setInterval(() => {
            console.log('[Shard Manager] Checking to reset restart counters...');
            this.status.forEach((status, shardId) => {
                if (status.status === 'ready' && Date.now() - status.lastHeartbeat < 300000) { // Stable for 5 mins
                    if (status.restarts > 0) {
                        console.log(`[Shard ${shardId}] Resetting restart counter (was ${status.restarts})`);
                        status.restarts = 0;
                        status._cleanSpawnAttempted = false; // Also reset clean spawn attempt flag
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
        let nodeArgs = config.shardArgs || [];
        if (!nodeArgs.some(arg => arg.includes('--max-old-space-size'))) {
            const memoryLimitArg = calculateMemoryLimit(await calculateShardCount());
            nodeArgs.push(memoryLimitArg);
        }
        
        // Calculate shard count
        const shardCount = await calculateShardCount();
        console.log(`Starting bot with ${shardCount} shard(s)...`);
        console.log(`Using Node.js args: ${nodeArgs.join(' ')}`);

        // Get absolute path to bot.js
        const botPath = path.join(__dirname, 'bot.js');
        console.log(`Bot script path: ${botPath}`);

        const manager = new CustomShardingManager(botPath, {
            token: config.token,
            totalShards: shardCount,
            respawn: false, // Disable automatic respawn by discord.js, we handle it manually
            timeout: 300000, // 5 minutes
            execArgv: nodeArgs
        });

        // Add rate limit protection
        // setupRateLimitProtection(manager); // Temporarily disable if suspected of causing issues

        // Start monitoring
        manager.startMonitoring();
        
        // Spawn shards
        console.log('Spawning shards...');
        await manager.spawn({
            amount: shardCount, // Specify amount explicitly
            delay: 7500, // 7.5 seconds delay between shard spawns
            timeout: 300000 // 5 minutes
        });
        
        console.log('All shards spawned successfully');
        
        // Update all shard stats after 30 seconds to let them initialize
        setTimeout(async () => {
            try {
                await manager.updateAllShardStats();
                manager.logStats();
            } catch (statsError) {
                console.error('Error during initial stats update:', statsError);
            }
        }, 30000);
        
        // Handle process termination
        setupShutdownHandlers(manager);

    } catch (error) {
        // Catch errors during the initial manager setup and spawn
        console.error('[CRITICAL] Failed to start sharding manager or spawn initial shards:', error);
        process.exit(1); // Exit if manager cannot start
    }
}

function setupShutdownHandlers(manager) {
    let shuttingDown = false;
    
    async function shutdown() {
        if (shuttingDown) return;
        shuttingDown = true;
        
        console.log('[Manager] Received shutdown signal. Starting graceful shutdown...');
        
        try {
            await manager.gracefulShutdown();
            console.log('[Manager] Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('[Manager] Error during graceful shutdown:', error);
            process.exit(1); // Exit forcefully if shutdown fails
        }
    }
    
    // Handle different termination signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // For Nodemon restart
    
    // Handle uncaught exceptions in the manager process
    process.on('uncaughtException', (error, origin) => {
        console.error('[Manager CRITICAL] Uncaught exception:', error);
        console.error(`[Manager CRITICAL] Origin: ${origin}`);
        
        // Attempt graceful shutdown, but exit forcefully if it fails
        shutdown().catch(() => process.exit(1)); 
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('[Manager CRITICAL] Unhandled promise rejection:', reason);
        // Potentially log promise details if needed
        // Decide if shutdown is necessary based on the rejection reason
        // For now, just log it.
    });
}

// --- Start the sharding process --- 
startSharding();

const { ShardingManager } = require('discord.js');
const { token } = require('../../config.json');

class CustomShardingManager extends ShardingManager {
    constructor(file, options) {
        super(file, options);
        this.status = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.on('shardCreate', shard => {
            console.log(`[Shard Manager] Launched shard ${shard.id}`);
            this.status.set(shard.id, {
                status: 'starting',
                lastHeartbeat: Date.now(),
                restarts: 0
            });

            // Handle shard specific events
            shard.on('ready', () => {
                console.log(`[Shard ${shard.id}] Ready`);
                this.status.get(shard.id).status = 'ready';
            });

            shard.on('disconnect', () => {
                console.log(`[Shard ${shard.id}] Disconnected`);
                this.status.get(shard.id).status = 'disconnected';
                this.handleShardDisconnect(shard);
            });

            shard.on('death', () => {
                console.log(`[Shard ${shard.id}] Died`);
                this.status.get(shard.id).status = 'dead';
                this.handleShardDeath(shard);
            });

            // Setup heartbeat monitoring
            shard.on('message', message => {
                if (message === 'heartbeat') {
                    this.status.get(shard.id).lastHeartbeat = Date.now();
                }
            });
        });
    }

    async handleShardDisconnect(shard) {
        const status = this.status.get(shard.id);
        if (status.restarts < 5) {
            console.log(`[Shard ${shard.id}] Attempting reconnection...`);
            status.restarts++;
            try {
                await shard.respawn();
                console.log(`[Shard ${shard.id}] Successfully respawned`);
            } catch (error) {
                console.error(`[Shard ${shard.id}] Failed to respawn:`, error);
            }
        } else {
            console.error(`[Shard ${shard.id}] Too many restart attempts, manual intervention required`);
        }
    }

    async handleShardDeath(shard) {
        const status = this.status.get(shard.id);
        if (status.restarts < 5) {
            console.log(`[Shard ${shard.id}] Attempting resurrection...`);
            status.restarts++;
            try {
                await shard.respawn({ delay: 5000 + (status.restarts * 1000) });
                console.log(`[Shard ${shard.id}] Successfully resurrected`);
            } catch (error) {
                console.error(`[Shard ${shard.id}] Failed to resurrect:`, error);
            }
        } else {
            console.error(`[Shard ${shard.id}] Shard died too many times, manual intervention required`);
        }
    }

    startMonitoring() {
        // Monitor shard health every minute
        setInterval(() => {
            const now = Date.now();
            this.status.forEach((status, shardId) => {
                if (status.status === 'ready' && now - status.lastHeartbeat > 60000) {
                    console.warn(`[Shard ${shardId}] No heartbeat received in 60s, investigating...`);
                    this.shards.get(shardId)?.eval('this.ws.ping')
                        .then(ping => {
                            if (ping === -1) {
                                console.error(`[Shard ${shardId}] Connection appears dead, attempting restart`);
                                this.handleShardDisconnect(this.shards.get(shardId));
                            }
                        })
                        .catch(error => {
                            console.error(`[Shard ${shardId}] Failed to check ping:`, error);
                        });
                }
            });
        }, 60000);

        // Reset restart counters every 6 hours if shard is stable
        setInterval(() => {
            this.status.forEach(status => {
                if (status.status === 'ready' && Date.now() - status.lastHeartbeat < 300000) {
                    status.restarts = 0;
                }
            });
        }, 21600000);
    }
}

// Calculate optimal number of shards based on guild count
async function calculateShardCount() {
    try {
        const { Client, GatewayIntentBits } = require('discord.js');
        const tempClient = new Client({ intents: [GatewayIntentBits.Guilds] });
        await tempClient.login(token);
        const guildCount = (await tempClient.guilds.fetch()).size;
        await tempClient.destroy();
        
        // Discord recommends 1000-2000 guilds per shard
        const shardsNeeded = Math.ceil(guildCount / 1000);
        return Math.max(1, shardsNeeded);
    } catch (error) {
        console.error('Failed to calculate shard count:', error);
        return 1; // Default to 1 shard if calculation fails
    }
}

async function startSharding() {
    try {
        const shardCount = await calculateShardCount();
        console.log(`Starting bot with ${shardCount} shard(s)...`);

        const manager = new CustomShardingManager('./bot.js', {
            token: token,
            totalShards: shardCount,
            respawn: true,
            timeout: 60000,
            execArgv: ['--max-old-space-size=2048'] // Increase memory limit for large shards
        });

        manager.startMonitoring();
        await manager.spawn();
        
        // Handle process termination
        process.on('SIGINT', async () => {
            console.log('Received SIGINT. Gracefully shutting down shards...');
            for (const [id, shard] of manager.shards) {
                try {
                    await shard.eval('this.destroy()');
                    console.log(`Shard ${id} shutdown complete`);
                } catch (error) {
                    console.error(`Error shutting down shard ${id}:`, error);
                }
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start sharding:', error);
        process.exit(1);
    }
}

startSharding();

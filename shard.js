const config = require('./config.json');
const { ShardingManager } = require('discord.js')

const manager = new ShardingManager('./bot.js', {
    totalShards: "auto", // or number e.g ( totalShards: 10 )
    token: config.token, // or token e.g ( token: "YOUR BOT TOKEN" )
    respawn: true
});

manager.on("shardCreate", shard => {
    // Listeing for the ready event on shard.
    shard.on("ready", () => {
        console.log(`[DEBUG/SHARD] Shard ${shard.id} connected to Discord's Gateway.`);
        // Sending the data to the shard.
        shard.send({ type: "shardId", data: { shardId: shard.id } });
    });

    shard.on('error', (error) => {
        console.error(`[ERROR] Shard (${shard.id}) received error: ${error}`);
    });

    shard.on('disconnect', (event, shardID) => {
        console.log(`[INFO] Shard ${shardID} disconnected. Reconnecting...`);
        // Respawn the disconnected shard
        manager.spawn(shardID).catch(error => console.error(`[ERROR/SHARD] Shard ${shardID} failed to respawn. ${error}`));
    });

    shard.on('reconnecting', (event, shardID) => {
        console.log(`[INFO] Shard ${shardID} reconnecting...`);
    });

    shard.on('death', (event, shardID) => {
        console.log(`[INFO] Shard ${shardID} died. Respawning...`);
        // Respawn the dead shard
        manager.spawn(shardID).catch(error => console.error(`[ERROR/SHARD] Shard ${shardID} failed to respawn. ${error}`));
    });
});

manager.spawn().catch(error => console.error(`[ERROR/SHARD] Shard failed to spawn. ${error}`));

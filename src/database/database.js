import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Connection pool implementation
class ConnectionPool {
    constructor(maxConnections = 10) {
        this.pool = [];
        this.maxConnections = maxConnections;
        this.inUse = new Set();
    }

    async getConnection() {
        // Try to get an existing unused connection
        const availableConnection = this.pool.find(conn => !this.inUse.has(conn));
        if (availableConnection) {
            this.inUse.add(availableConnection);
            return availableConnection;
        }

        // Create new connection if pool isn't full
        if (this.pool.length < this.maxConnections) {
            const newConnection = await open({
                filename: 'data.db',
                driver: sqlite3.Database
            });
            
            // Enable WAL mode for better concurrent access
            await newConnection.exec('PRAGMA journal_mode = WAL');
            await newConnection.exec('PRAGMA synchronous = NORMAL');
            await newConnection.exec('PRAGMA cache_size = 10000');
            await newConnection.exec('PRAGMA temp_store = MEMORY');
            
            this.pool.push(newConnection);
            this.inUse.add(newConnection);
            return newConnection;
        }

        // Wait for a connection to become available
        return new Promise(resolve => {
            const checkPool = setInterval(async () => {
                const conn = this.pool.find(c => !this.inUse.has(c));
                if (conn) {
                    clearInterval(checkPool);
                    this.inUse.add(conn);
                    resolve(conn);
                }
            }, 100);
        });
    }

    async releaseConnection(connection) {
        this.inUse.delete(connection);
    }

    async closeAll() {
        await Promise.all(this.pool.map(conn => conn.close()));
        this.pool = [];
        this.inUse.clear();
    }
}

const connectionPool = new ConnectionPool();

// Cache implementation
const cache = {
    data: new Map(),
    maxAge: 5 * 60 * 1000, // 5 minutes
    get(key) {
        const item = this.data.get(key);
        if (item && Date.now() - item.timestamp < this.maxAge) {
            return item.value;
        }
        this.data.delete(key);
        return null;
    },
    set(key, value) {
        this.data.set(key, {
            value,
            timestamp: Date.now()
        });
    },
    clear() {
        const now = Date.now();
        for (const [key, item] of this.data.entries()) {
            if (now - item.timestamp > this.maxAge) {
                this.data.delete(key);
            }
        }
    }
};

// Clear expired cache entries periodically
setInterval(() => cache.clear(), 60000);

// Helper to validate chatid/guildId format
function isValidChatId(chatid) {
    // Basic check: ensure it's a string containing only digits (adjust regex if IDs can have other chars)
    return typeof chatid === 'string' && /^[0-9]+$/.test(chatid);
}

async function withConnection(operation) {
    const conn = await connectionPool.getConnection();
    try {
        const result = await operation(conn);
        return result;
    } finally {
        await connectionPool.releaseConnection(conn);
    }
}

async function insert(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    try {
        // Check existence first, more direct
        const exists = await chatExists(chatid);
        if (!exists) {
             await retry(() => createTable(chatid));
        }
    } catch (e) {
        // If chatExists fails, maybe try creating anyway?
        console.error(`Error during insert check for ${chatid}, attempting createTable:`, e);
        await retry(() => createTable(chatid));
    }
}

async function getChat(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    const cacheKey = `chat_${chatid}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const result = await retry(() => fetchChat(chatid), {
        retries: 3,
        delay: 100
    });

    cache.set(cacheKey, result);
    return result;
}

async function createTable(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    await withConnection(async (db) => {
        // Use template literal *only* after validation
        const tableName = `peer${chatid}`;
        await db.exec(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id TEXT DEFAULT '${chatid}', 
                talk INT DEFAULT 1,
                gen INT DEFAULT 0,
                speed INT DEFAULT 3,
                textbase TEXT,
                lang TEXT DEFAULT 'en'
            );
            CREATE INDEX IF NOT EXISTS idx_${tableName}_textbase ON ${tableName}(textbase);
        `);

        const result = await db.get(`SELECT 1 FROM ${tableName} WHERE peer_id = ? LIMIT 1`, [chatid]);

        if (!result) {
            try {
                await db.run(`
                    INSERT INTO ${tableName}
                    (peer_id, talk, gen, speed, lang)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    chatid, // Parameterized
                    1, 
                    0, 
                    3, 
                    'en',
                ]);
            } catch (insertError) {
                 // Handle potential race condition if another process inserted simultaneously
                 if (!insertError.message.includes('UNIQUE constraint failed')) {
                     throw insertError; // Re-throw other errors
                 }
                 console.warn(`Insert failed for ${tableName}, likely race condition.`);
             }
        }
        // Invalidate exists cache after ensuring table/row exists
        cache.data.delete(`exists_${chatid}`);
    });
}

async function fetchChat(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    return await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        const [chat, textbase] = await Promise.all([
            db.get(`SELECT * FROM ${tableName} WHERE peer_id = ?`, [chatid]), // Ensure fetching for the correct peer_id
            db.all(`
                SELECT textbase 
                FROM ${tableName} 
                WHERE textbase IS NOT NULL AND textbase != ''
                ORDER BY id DESC
                LIMIT 1000
            `)
        ]);
        
        if (!chat) { // Handle case where peer_id row doesn't exist yet
            // Optionally, create the row here or throw a specific error
            console.warn(`No chat settings row found for ${tableName}, peer_id ${chatid}`);
            // Returning a default structure or throwing might be better
            return { peer_id: chatid, talk: 1, gen: 0, speed: 3, lang: 'en', textbase: [] }; 
        }

        chat.textbase = textbase.map(i => i.textbase);
        return chat;
    });
}

async function retry(operation, options = {}) {
    const { retries = 3, delay = 100 } = options;
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            return await operation();
        } catch (e) {
            lastError = e;
            if (i < retries) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    throw lastError;
}

async function chatExists(chatid) {
    if (!isValidChatId(chatid)) {
        // Decide how to handle invalid ID here - throw or return false?
        console.error(`Invalid chat ID format requested in chatExists: ${chatid}`);
        return false; 
    }
    const cacheKey = `exists_${chatid}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult !== null) {
        return cachedResult;
    }

    const exists = await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        const chat = await db.get(
            `SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`,
            [tableName] // Parameterized table name check
        );
        return chat !== undefined;
    });

    cache.set(cacheKey, exists);
    return exists;
}

async function deleteFirst(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    return await retry(async () => {
        return await withConnection(async (db) => {
            const tableName = `peer${chatid}`;
            // ... rest of deleteFirst implementation using tableName ...
            await db.run(`
                DELETE FROM ${tableName} 
                WHERE id = (
                    SELECT id FROM ${tableName} 
                    WHERE textbase IS NOT NULL AND textbase != ''
                    ORDER BY id ASC 
                    LIMIT 1
                )
            `);
            cache.data.delete(`chat_${chatid}`);
            // Returning a string message might be less useful than returning status/count
            return { success: true }; 
        });
    }, { retries: 3, delay: 100 });
}

async function updateText(chatid, text) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        await db.run(
            `INSERT INTO ${tableName} (textbase) VALUES (?)`,
            [text] // Parameterized
        );
        cache.data.delete(`chat_${chatid}`);
    });
}

// Define allowed fields to prevent SQL injection
const ALLOWED_FIELDS_TO_CHANGE = ['talk', 'gen', 'speed', 'lang'];

async function changeField(chatid, field, key) {
    logger.debug(`[changeField ENTER] chatid=${chatid}, field=${field}, key=${key} (type: ${typeof key})`);

    if (!isValidChatId(chatid)) {
        logger.error(`[changeField] Invalid chat ID format: ${chatid}`);
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    // Prevent SQL injection by validating the field name
    if (!ALLOWED_FIELDS_TO_CHANGE.includes(field)) {
        logger.error(`[changeField] Attempted to change invalid field: ${field} for chat ${chatid}`);
        throw new Error(`Invalid field specified: ${field}`);
    }

    let finalKey = key;
    // Validate and sanitize language field
    if (field === 'lang') {
        logger.debug(`[changeField] Validating lang field. Initial value: ${key}`);
        if (finalKey === null || finalKey === undefined || finalKey === 'null' || finalKey === '') {
            logger.warn(`[changeField] Invalid lang value detected: "${finalKey}". Defaulting to 'en'.`);
            finalKey = 'en';
        }
        
        const supportedLangs = ['en', 'ru', 'uk', 'tr'];
        if (!supportedLangs.includes(finalKey)) {
            logger.warn(`[changeField] Unsupported lang value: "${finalKey}". Defaulting to 'en'.`);
            finalKey = 'en';
        }
        logger.debug(`[changeField] Final lang value after validation: ${finalKey}`);
    }

    logger.info(`[changeField] Attempting to change ${field} to ${finalKey} for chat ${chatid}`);
    
    let operationResult = null; // Define outside to ensure it's accessible
    try {
        operationResult = await withConnection(async (db) => {
            const tableName = `peer${chatid}`;
            logger.debug(`[changeField] Using table: ${tableName}`);
            
            // 1. Check table existence
            logger.debug(`[changeField] Checking table existence...`);
            const tableExists = await db.get(
                `SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`,
                [tableName]
            );
            logger.debug(`[changeField] Table exists check result: ${tableExists ? 'Exists' : 'Does not exist'}`);
            
            if (!tableExists) {
                logger.warn(`[changeField] Table ${tableName} doesn't exist, creating it first.`);
                await createTable(chatid); // Ensure createTable handles logging/errors
                logger.info(`[changeField] Table ${tableName} created.`);
            }
            
            // 2. Attempt UPDATE
            const updateQuery = `UPDATE ${tableName} SET ${field} = ? WHERE peer_id = ?`;
            const updateParams = [finalKey, chatid];
            logger.debug(`[changeField] Executing UPDATE query: ${updateQuery} with params: ${JSON.stringify(updateParams)}`);
            
            const updateResult = await db.run(updateQuery, updateParams);
            logger.info(`[changeField] UPDATE result: ${JSON.stringify(updateResult)}`);
            logger.info(`[changeField] Rows changed by UPDATE: ${updateResult.changes}`);
            
            // 3. Handle case where UPDATE didn't change rows
            if (updateResult.changes === 0) {
                logger.warn(`[changeField] UPDATE affected 0 rows. Checking if peer_id ${chatid} exists...`);
                const rowExistsResult = await db.get(`SELECT 1 FROM ${tableName} WHERE peer_id = ? LIMIT 1`, [chatid]);
                logger.info(`[changeField] Row existence check result: ${rowExistsResult ? 'Exists' : 'Does not exist'}`);
                
                if (!rowExistsResult) {
                    logger.warn(`[changeField] No row with peer_id ${chatid}, attempting INSERT.`);
                    const insertQuery = `INSERT INTO ${tableName} (peer_id, ${field}) VALUES (?, ?)`;
                    const insertParams = [chatid, finalKey];
                    logger.debug(`[changeField] Executing INSERT query: ${insertQuery} with params: ${JSON.stringify(insertParams)}`);
                    const insertResult = await db.run(insertQuery, insertParams);
                    logger.info(`[changeField] INSERT result: ${JSON.stringify(insertResult)}`);
                } else {
                    logger.warn(`[changeField] Row exists but UPDATE had no effect. Current value might already be ${finalKey}, or there's another issue.`);
                    // Log current value for debugging
                    const currentValue = await db.get(`SELECT ${field} FROM ${tableName} WHERE peer_id = ?`, [chatid]);
                    logger.warn(`[changeField] Current value of ${field} for ${chatid}: ${JSON.stringify(currentValue)}`);
                }
            }
            
            // 4. Verify the final value in the DB *before* cache invalidation
            logger.debug(`[changeField] Verifying final value in DB for field ${field}...`);
            const verificationResult = await db.get(`SELECT ${field} FROM ${tableName} WHERE peer_id = ?`, [chatid]);
            logger.info(`[changeField] DB Verification result for ${field}: ${JSON.stringify(verificationResult)}`);
            
            // 5. Invalidate cache
            const cacheKey = `chat_${chatid}`;
            const deletedFromCache = cache.data.delete(cacheKey);
            logger.info(`[changeField] Invalidating cache for key ${cacheKey}. Deleted: ${deletedFromCache}`);
            
            return verificationResult; // Return the value found in DB after update/insert
        });

        logger.info(`[changeField EXIT - SUCCESS] chatid=${chatid}, field=${field}. Final DB value: ${JSON.stringify(operationResult)}`);
        return operationResult;

    } catch (error) {
        logger.error(`[changeField EXIT - ERROR] Error during operation for chatid=${chatid}, field=${field}:`, error);
        // Re-throw the error to be handled by the caller
        throw error; 
    }
}

async function clearText(chatid) {
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        // Delete only rows with textbase, keep the settings row
        await db.run(`DELETE FROM ${tableName} WHERE textbase IS NOT NULL`);
        cache.data.delete(`chat_${chatid}`);
    });
}

async function sender() {
    return await withConnection(async (db) => {
        const cursor = await db.all(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' AND name LIKE 'peer%'
        `);
        return cursor.map(i => i.name.split('peer')[1]);
    });
}

async function deleteNulls(chatid) {
     if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        await db.run(`DELETE FROM ${tableName} WHERE textbase IS NULL`);
        cache.data.delete(`chat_${chatid}`);
    });
}

async function remove(chatid, args) {
     if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
     await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        let result;
        // Check if args looks like a user mention ID (string of digits)
        if (typeof args === 'string' && /^\d+$/.test(args)) {
            const userIdMention = `<@${args}>`;
            // Remove based on user mention - potentially slow if textbase is large
            result = await db.run(`DELETE FROM ${tableName} WHERE textbase LIKE ?`, [userIdMention + '%']); // Use LIKE ?
             console.log(`Removed ${result.changes} entries for user ID ${args} in ${tableName}`);
        } else if (typeof args === 'string') {
            // Remove based on exact string match
             result = await db.run(`DELETE FROM ${tableName} WHERE textbase = ?`, [args]); // Use = ?
            console.log(`Removed ${result.changes} entries matching string in ${tableName}`);
        } else {
            console.warn(`Invalid args type passed to remove function for ${tableName}:`, args);
             return;
        }
         cache.data.delete(`chat_${chatid}`);
     });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await connectionPool.closeAll();
    process.exit(0);
});

// Export functions
export {
    insert,
    getChat,
    chatExists,
    deleteFirst,
    updateText,
    changeField,
    clearText,
    sender,
    deleteNulls,
    remove
};

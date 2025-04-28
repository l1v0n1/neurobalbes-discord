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
    if (!isValidChatId(chatid)) {
        throw new Error(`Invalid chat ID format: ${chatid}`);
    }
    // Prevent SQL injection by validating the field name
    if (!ALLOWED_FIELDS_TO_CHANGE.includes(field)) {
        console.error(`Attempted to change invalid field: ${field}`);
        throw new Error(`Invalid field specified: ${field}`);
    }

    console.log(`[DEBUG] changeField: Changing ${field} to ${key} for chat ${chatid}`);
    
    const result = await withConnection(async (db) => {
        const tableName = `peer${chatid}`;
        
        console.log(`[DEBUG] changeField: Checking if table ${tableName} exists`);
        const tableExists = await db.get(
            `SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`,
            [tableName]
        );
        
        if (!tableExists) {
            console.log(`[DEBUG] changeField: Table ${tableName} doesn't exist, creating it first`);
            await createTable(chatid);
        }
        
        console.log(`[DEBUG] changeField: Running UPDATE query on table ${tableName}`);
        console.log(`[DEBUG] changeField: Query: UPDATE ${tableName} SET ${field} = ${key} WHERE peer_id = ${chatid}`);
        
        // Use validated field name safely in the query
        const updateResult = await db.run(
            `UPDATE ${tableName} SET ${field} = ? WHERE peer_id = ?`,
            [key, chatid] // Parameterized
        );
        
        console.log(`[DEBUG] changeField: Update result: ${JSON.stringify(updateResult)}`);
        console.log(`[DEBUG] changeField: Rows changed: ${updateResult.changes}`);
        
        if (updateResult.changes === 0) {
            console.log(`[DEBUG] changeField: No rows updated, checking if row exists`);
            const rowExists = await db.get(`SELECT 1 FROM ${tableName} WHERE peer_id = ?`, [chatid]);
            
            if (!rowExists) {
                console.log(`[DEBUG] changeField: No row with peer_id ${chatid}, inserting new row`);
                await db.run(`
                    INSERT INTO ${tableName}
                    (peer_id, ${field})
                    VALUES (?, ?)
                `, [chatid, key]);
            } else {
                console.log(`[DEBUG] changeField: Row exists but no changes made. This might be a bug.`);
            }
        }
        
        // Verify the change was made
        console.log(`[DEBUG] changeField: Verifying the change was made`);
        const verification = await db.get(`SELECT ${field} FROM ${tableName} WHERE peer_id = ?`, [chatid]);
        console.log(`[DEBUG] changeField: Verification result: ${JSON.stringify(verification)}`);
        
        // Invalidate cache for the updated chat
        console.log(`[DEBUG] changeField: Invalidating cache for chat ${chatid}`);
        cache.data.delete(`chat_${chatid}`);
        
        return verification;
    });
    
    return result;
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

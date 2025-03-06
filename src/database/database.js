const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

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
    try {
        await getChat(chatid);
    } catch (e) {
        await retry(() => createTable(chatid));
    }
}

async function getChat(chatid) {
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
    await withConnection(async (db) => {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS peer${chatid} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id INT DEFAULT ${chatid},
                talk INT DEFAULT 1,
                gen INT DEFAULT 0,
                speed INT DEFAULT 3,
                textbase TEXT,
                lang TEXT DEFAULT 'en'
            );
            CREATE INDEX IF NOT EXISTS idx_peer${chatid}_textbase ON peer${chatid}(textbase);
        `);

        const result = await db.get(`SELECT * FROM peer${chatid}`);

        if (!result) {
            await db.run(`
                INSERT OR IGNORE INTO peer${chatid}
                (peer_id, talk, gen, speed, lang)
                VALUES (:id, :talk, :gen, :speed, :lang)
            `, {
                ':id': chatid,
                ':talk': 1,
                ':gen': 0,
                ':speed': 3,
                ':lang': 'en',
            });
        }
    });
}

async function fetchChat(chatid) {
    return await withConnection(async (db) => {
        const [chat, textbase] = await Promise.all([
            db.get(`SELECT * FROM peer${chatid}`),
            db.all(`
                SELECT textbase 
                FROM peer${chatid} 
                WHERE textbase IS NOT NULL AND textbase != ''
                ORDER BY id DESC
                LIMIT 1000
            `)
        ]);
        
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
    const cacheKey = `exists_${chatid}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult !== null) {
        return cachedResult;
    }

    const exists = await withConnection(async (db) => {
        const chat = await db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [`peer${chatid}`]
        );
        return chat !== undefined;
    });

    cache.set(cacheKey, exists);
    return exists;
}

async function deleteFirst(chatid) {
    return await retry(async () => {
        return await withConnection(async (db) => {
            await db.run(`
                DELETE FROM peer${chatid} 
                WHERE id = (
                    SELECT id FROM peer${chatid} 
                    WHERE textbase IS NOT NULL 
                    ORDER BY id ASC 
                    LIMIT 1
                )
            `);
            cache.data.delete(`chat_${chatid}`);
            return "Successfully deleted first row.";
        });
    }, { retries: 3, delay: 100 });
}

async function updateText(chatid, text) {
    await withConnection(async (db) => {
        await db.run(
            `INSERT INTO peer${chatid} (textbase) VALUES (?)`,
            [text]
        );
        cache.data.delete(`chat_${chatid}`);
    });
}

async function changeField(chatid, field, key) {
    await withConnection(async (db) => {
        await db.run(
            `UPDATE peer${chatid} SET ${field} = ? WHERE peer_id = ?`,
            [key, chatid]
        );
        cache.data.delete(`chat_${chatid}`);
    });
}

async function clearText(chatid) {
    await withConnection(async (db) => {
        await db.run(`UPDATE peer${chatid} SET textbase = NULL WHERE peer_id = ?`, [chatid]);
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
    await withConnection(async (db) => {
        await db.run(`DELETE FROM peer${chatid} WHERE textbase IS NULL`);
        cache.data.delete(`chat_${chatid}`);
    });
}

async function remove(chatid, args) {
    await withConnection(async (db) => {
        await db.run(
            `DELETE FROM peer${chatid} WHERE textbase LIKE ?`,
            [`%${args}%`]
        );
        cache.data.delete(`chat_${chatid}`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await connectionPool.closeAll();
    process.exit(0);
});

module.exports = {
    insert,
    getChat,
    updateText,
    changeField,
    clearText,
    sender,
    chatExists,
    deleteNulls,
    remove,
    deleteFirst,
};

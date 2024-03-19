const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let dbPromise = null;

async function openDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: 'data.db',
      driver: sqlite3.Database,
    });
  }
  return dbPromise;
}

async function insert(chatid) {
  try {
    await getChat(chatid);
  } catch (e) {
    await retry(() => createTable(chatid));
  }
}

async function getChat(chatid) {
  const retryOptions = {
    retries: 3, // Количество попыток выполнить операцию
    delay: 100, // Задержка между попытками (в миллисекундах)
  };

  return await retry(() => fetchChat(chatid), retryOptions);
}

async function createTable(chatid) {
  const db = await openDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS peer${chatid}
    (peer_id INT DEFAULT ${chatid},
      talk INT DEFAULT 1,
      gen INT DEFAULT 0,
      speed INT DEFAULT 3,
      textbase TEXT,
      lang TEXT DEFAULT 'en'
    )`
  );

  const result = await db.get(`SELECT * FROM peer${chatid}`);

  if (!result) {
    await db.run(`INSERT OR IGNORE INTO peer${chatid}
        (peer_id, talk, gen, speed, lang)
        VALUES (:id, :talk, :gen, :speed, :lang)`, {
      ':id': chatid,
      ':talk': 1,
      ':gen': 0,
      ':speed': 3,
      ':lang': 'en',
    });
  }
}

async function fetchChat(chatid) {
  const db = await openDb();
  const [chat, textbase] = await Promise.all([
    db.get(`SELECT * FROM peer${chatid}`),
    db.all(`SELECT textbase FROM peer${chatid} WHERE textbase IS NOT NULL AND textbase != ''`),
  ]);
  chat.textbase = textbase.map(i => i.textbase);
  return chat;
}

async function retry(operation, options) {
  const { retries = 3, delay = 100 } = options || {};
  let error;

  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (e) {
      error = e;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw error; // Если все попытки не удалось выполнить операцию, выбрасываем ошибку
}

async function chatExists(chatid) {
  const db = await openDb();
  const chat = await db.get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name="peer${chatid}";`
  );
  return chat !== undefined;
}

async function deleteFirst(chatid) {
  const retryOptions = {
    retries: 3, // Количество попыток выполнить операцию
    delay: 100, // Задержка между попытками (в миллисекундах)
  };

  return await retry(async () => {
    const db = await openDb();
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Добавляем задержку в 1 секунду перед удалением первой строки
      await db.run(
        `DELETE FROM peer${chatid} WHERE ROWID = (SELECT ROWID FROM peer${chatid} LIMIT 1)`
      );
      return "Успешно удалена первая строка.";
    } catch (e) {
      console.log(`Ошибка при удалении первой строки: ${e}`);
      throw e; // Пробрасываем ошибку, чтобы выполнить повторную попытку
    }
  }, retryOptions);
}


async function updateText(chatid, text) {
  const db = await openDb();
  await db.run(
    `INSERT OR IGNORE INTO peer${chatid} (textbase) VALUES (?)`,
    [text]
  );
}

async function changeField(chatid, field, key) {
  const db = await openDb();
  await db.run(`UPDATE peer${chatid} SET ${field} = ?`, [key]);
}

async function clearText(chatid) {
  const db = await openDb();
  await db.run(`UPDATE peer${chatid} SET textbase = NULL`);
}

async function sender() {
  const db = await openDb();
  const cursor = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
  const chats = cursor.map(i => i.name.split('peer')[1]);
  return chats;
}

async function deleteNulls(chatid) {
  const db = await openDb();
  await db.run(`DELETE FROM peer${chatid} WHERE textbase IS NULL`);
}

async function remove(chatid, args) {
  const db = await openDb();
  await db.run(`DELETE FROM peer${chatid} WHERE textbase LIKE ?`, [`%${args}%`]);
}

async function add_new_field(field) {
  const db = await openDb();
  const cursor = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
  for (let i of cursor) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Пауза в 100 миллисекунд перед каждой итерацией
    await db.run(`ALTER TABLE ${i.name} ADD COLUMN ${field} TEXT`);
    console.log(i.name);
  }
  console.log('finish');
}

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

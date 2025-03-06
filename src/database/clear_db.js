const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db');

const deleteExcessRows = () => {
  const getTablesQuery = `SELECT name FROM sqlite_master WHERE type='table'`;
  db.all(getTablesQuery, function(err, tables) {
    if (err) {
      console.error(err.message);
    } else {
      tables.forEach((table) => {
        const tableName = table.name;
        const countQuery = `SELECT COUNT(*) AS totalRows FROM ${tableName}`;
        db.get(countQuery, function(err, result) {
          if (err) {
            console.error(err.message);
          } else {
            const totalRows = result.totalRows;
            const rowsToDelete = totalRows - 2000;
            if (rowsToDelete > 0) {
              const deleteQuery = `DELETE FROM ${tableName} WHERE ROWID IN (SELECT ROWID FROM ${tableName} ORDER BY peer_id ASC LIMIT ?)`;
              db.run(deleteQuery, rowsToDelete, function(err) {
                if (err) {
                  console.error(err.message);
                } else {
                  console.log(`В таблице ${tableName} удалено ${this.changes} строк.`);
                }
              });
            } else {
              console.log(`В таблице ${tableName} нет необходимости удалять строки.`);
            }
          }
        });
      });
    }
  });
};

// Вызовите функцию для удаления лишних строк во всех таблицах
deleteExcessRows();

// Закройте соединение с базой данных после выполнения операций
db.close();

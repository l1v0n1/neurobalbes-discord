import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('data.db');

// Configurable row limit per table
const MAX_ROWS_PER_TABLE = 2000;

/**
 * Deletes the oldest rows from each table in the database 
 * if the total row count exceeds MAX_ROWS_PER_TABLE.
 * Assumes tables have an auto-incrementing primary key named 'id'.
 */
const deleteExcessRows = () => {
  const getTablesQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`; // Exclude sqlite internal tables

  db.all(getTablesQuery, (err, tables) => { // Use arrow function for consistent `this` if needed later, though not used here
    if (err) {
      console.error("Error fetching tables: ", err.message);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log("No user tables found to process.");
      return;
    }

    tables.forEach((table) => {
      const tableName = table.name;
      // Basic validation for table name pattern if necessary
      if (!/^peer\d+$/.test(tableName)) {
        console.warn(`Skipping table with unexpected name format: ${tableName}`);
        return; 
      }

      const countQuery = `SELECT COUNT(*) AS totalRows FROM \`${tableName}\``; // Use backticks for safety

      db.get(countQuery, (err, result) => {
        if (err) {
          console.error(`Error counting rows in ${tableName}:`, err.message);
          return;
        }

        const totalRows = result.totalRows;
        const rowsToDelete = totalRows - MAX_ROWS_PER_TABLE;

        if (rowsToDelete > 0) {
          console.log(`Table ${tableName} has ${totalRows} rows. Attempting to delete ${rowsToDelete} oldest rows.`);
          // Correctly order by the auto-incrementing ID to delete the oldest rows
          const deleteQuery = `DELETE FROM \`${tableName}\` WHERE id IN (SELECT id FROM \`${tableName}\` ORDER BY id ASC LIMIT ?)`;
          
          db.run(deleteQuery, [rowsToDelete], function(deleteErr) { // Pass limit as array
            // Note: `this` refers to the statement object in sqlite3 callback
            if (deleteErr) {
              console.error(`Error deleting rows from ${tableName}:`, deleteErr.message);
            } else {
              console.log(`Table ${tableName}: Successfully deleted ${this.changes} rows.`);
            }
          });
        } else {
          // console.log(`Table ${tableName} has ${totalRows} rows. No deletion needed.`); // Optional: reduce verbosity
        }
      });
    });
  });
};

console.log("Starting database cleanup script...");
deleteExcessRows();

// Close the database connection gracefully
// Note: Operations might still be running when close is called.
// For a more robust script, consider using Promise wrappers and closing after all operations complete.
db.close((err) => {
  if (err) {
    console.error("Error closing database connection: ", err.message);
  } else {
    console.log("Database connection closed. Cleanup script finished.");
  }
});

const db = require("./config/database");

console.log("\n========== STRAYSYNC DATABASE TABLES ==========\n");

const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`).all();

for (const table of tables) {
    console.log(`\nTABLE: ${table.name}`);

    const columns = db.prepare(`
        PRAGMA table_info("${table.name}")
    `).all();

    for (const column of columns) {
        console.log(
            `  ${column.name} | ${column.type} | ` +
            `Primary Key: ${column.pk ? "Yes" : "No"}`
        );
    }
}

console.log("\n========== INSPECTION COMPLETE ==========\n");

db.close();
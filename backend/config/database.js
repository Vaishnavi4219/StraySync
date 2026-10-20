const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Create the database directory if required
const databaseDirectory = path.join(__dirname, "..", "data");

if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
}

// Database file location
const databasePath = path.join(databaseDirectory, "straySync.db");

// Connect to SQLite
const db = new Database(databasePath);

// Enable foreign key relationships
db.pragma("foreign_keys = ON");

// Enable write-ahead logging
db.pragma("journal_mode = WAL");

console.log("StraySync database connected successfully!");

module.exports = db;
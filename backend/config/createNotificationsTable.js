const db = require("./database");

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_id INTEGER NOT NULL,
            recipient_role TEXT NOT NULL
                CHECK(recipient_role IN ('citizen', 'officer', 'staff')),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notification_type TEXT NOT NULL,
            related_id INTEGER,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_recipient
        ON notifications (
            recipient_role,
            recipient_id,
            is_read,
            created_at
        );
    `);

    console.log("Notifications table created successfully!");

} catch (error) {
    console.error("Error creating notifications table:", error.message);
} finally {
    db.close();
}
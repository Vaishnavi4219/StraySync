const db = require("./config/database");

try {
    const staff = db.prepare(`
        SELECT
            id,
            full_name,
            employee_id,
            official_email,
            account_status,
            created_at
        FROM staff
        ORDER BY id DESC
    `).all();

    console.log("\n===== STRAYSYNC STAFF RECORDS =====\n");

    if (staff.length === 0) {
        console.log("No staff accounts found.");
    } else {
        console.table(staff);
    }

    console.log("\nTotal staff accounts:", staff.length);
} catch (error) {
    console.error("Database check failed:", error.message);
}
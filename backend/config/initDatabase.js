const db = require("./database");

// ==========================================
// 1. CITIZENS
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS citizens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE,
        email TEXT,
        password_hash TEXT NOT NULL,
        phone_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

// ==========================================
// 2. MUNICIPAL OFFICERS
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS officers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        official_email TEXT NOT NULL UNIQUE,
        mobile TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        account_status TEXT NOT NULL DEFAULT 'Pending Approval',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

// ==========================================
// 3. RESCUE AND FIELD STAFF
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        official_email TEXT NOT NULL UNIQUE,
        mobile TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        account_status TEXT NOT NULL DEFAULT 'Pending Approval',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

// ==========================================
// 4. ANIMAL COMPLAINTS
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id INTEGER NOT NULL,
        animal_type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        original_photo TEXT,
        priority TEXT NOT NULL DEFAULT 'Medium',
        status TEXT NOT NULL DEFAULT 'Pending Review',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    );
`);

// ==========================================
// 5. STAFF ASSIGNMENTS
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        staff_id INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id),
        FOREIGN KEY (staff_id) REFERENCES staff(id),
        FOREIGN KEY (assigned_by) REFERENCES officers(id)
    );
`);

// ==========================================
// 6. RESOLUTION REPORTS
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS resolution_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        staff_id INTEGER NOT NULL,
        action_description TEXT NOT NULL,
        evidence_photo TEXT,
        verification_status TEXT NOT NULL DEFAULT 'Pending Verification',
        officer_feedback TEXT,
        submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
`);

// ==========================================
// 7. EXISTING MOBILE OTP CHALLENGES
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS otp_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id INTEGER NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_otp_citizen_created
    ON otp_challenges(citizen_id, created_at);
`);

// ==========================================
// 8. CITIZEN FEEDBACK
// ==========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS citizen_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        citizen_id INTEGER NOT NULL,
        report_id INTEGER NOT NULL UNIQUE,
        feedback TEXT NOT NULL,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id),
        FOREIGN KEY (citizen_id) REFERENCES citizens(id),
        FOREIGN KEY (report_id) REFERENCES resolution_reports(id)
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feedback_complaint
    ON citizen_feedback(complaint_id);
`);

// ==========================================
// 9. EMAIL VERIFICATION MIGRATION
// ==========================================

// Check whether email_verified already exists.
const citizenColumns = db.prepare(
    "PRAGMA table_info(citizens)"
).all();

const emailVerifiedExists = citizenColumns.some(
    column => column.name === "email_verified"
);

// Add the column without deleting or rebuilding existing records.
if (!emailVerifiedExists) {
    db.exec(`
        ALTER TABLE citizens
        ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
    `);

    // Preserve login access for existing accounts with email addresses.
    db.exec(`
        UPDATE citizens
        SET email_verified = 1
        WHERE email IS NOT NULL
        AND TRIM(email) != '';
    `);
}

// ==========================================
// 10. UNIQUE CITIZEN EMAIL
// ==========================================

// Prevent multiple citizen accounts from using the same email.
// NULL and empty email values are excluded.
db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citizens_email_unique
    ON citizens(LOWER(TRIM(email)))
    WHERE email IS NOT NULL AND TRIM(email) != '';
`);

// ==========================================
// 11. EMAIL OTP CHALLENGES
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS email_otp_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id INTEGER NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_otp_citizen_created
    ON email_otp_challenges(citizen_id, created_at);
`);

// ==========================================
// DATABASE READY
// ==========================================

console.log("StraySync database tables created successfully!");
console.log("Existing mobile OTP table is ready.");
console.log("Email verification column is ready.");
console.log("Unique citizen email index is ready.");
console.log("Email OTP challenge table is ready.");
console.log("Citizen feedback table is ready.");

// Close the connection because this script is run separately.

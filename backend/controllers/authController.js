// ========================================
// STRAYSYNC - AUTHENTICATION CONTROLLER
// ========================================

const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ========================================
// CONFIGURATION
// ========================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

const isDevelopmentOTPEnabled = () =>
    process.env.NODE_ENV === "development" &&
    process.env.OTP_MODE === "development";

const hashOTP = (otp) =>
    crypto.createHash("sha256").update(otp).digest("hex");

const isValidMobile = (mobile) =>
    typeof mobile === "string" &&
    /^[6-9]\d{9}$/.test(mobile);

const isValidEmail = (email) =>
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ========================================
// CITIZEN LOGIN TOKEN
// ========================================

const createLoginToken = (citizen) => {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET is missing or too short.");
    }

    return jwt.sign(
        {
            citizenId: citizen.id,
            role: "citizen"
        },
        secret,
        {
            expiresIn: "2h",
            issuer: "straysync"
        }
    );
};

// ========================================
// CITIZEN REGISTRATION
// ========================================

const registerCitizen = async (req, res) => {
    try {
        const { fullName, mobile, email, password } = req.body;

        if (
            typeof fullName !== "string" ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 100 ||
            !isValidMobile(mobile) ||
            typeof password !== "string" ||
            password.length < 8 ||
            password.length > 128
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, mobile number and password."
            });
        }

        if (
            email !== undefined &&
            email !== null &&
            (
                typeof email !== "string" ||
                email.length > 254 ||
                (
                    email.trim() !== "" &&
                    !isValidEmail(email.trim())
                )
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        const existing = db.prepare(
            "SELECT id FROM citizens WHERE mobile = ?"
        ).get(mobile);

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This mobile number is already registered. Please sign in."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO citizens (
                full_name,
                mobile,
                email,
                password_hash,
                phone_verified
            )
            VALUES (?, ?, ?, ?, 0)
        `).run(
            fullName.trim(),
            mobile,
            typeof email === "string" && email.trim()
                ? email.trim()
                : null,
            passwordHash
        );

        return res.status(201).json({
            success: true,
            message: "Registration successful. Sign in to verify your mobile number.",
            citizenId: Number(result.lastInsertRowid),
            phoneVerified: false
        });

    } catch (error) {
        console.error("Citizen registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to register right now. Please try again."
        });
    }
};

// ========================================
// CITIZEN LOGIN — START OTP CHALLENGE
// ========================================

const loginCitizen = async (req, res) => {
    try {
        const { mobile, password } = req.body;

        if (
            !isValidMobile(mobile) ||
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid mobile number and password."
            });
        }

        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                mobile,
                email,
                password_hash,
                phone_verified
            FROM citizens
            WHERE mobile = ?
        `).get(mobile);

        if (
            !citizen ||
            !(await bcrypt.compare(password, citizen.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid mobile number or password."
            });
        }

        // Already verified: allow normal login.
        if (citizen.phone_verified === 1) {
            const token = createLoginToken(citizen);

            return res.status(200).json({
                success: true,
                requiresOTP: false,
                message: "Login successful.",
                token,
                citizen: {
                    id: citizen.id,
                    fullName: citizen.full_name,
                    mobile: citizen.mobile,
                    email: citizen.email
                }
            });
        }

        // Development OTP must never be enabled in production.
        if (!isDevelopmentOTPEnabled()) {
            return res.status(503).json({
                success: false,
                message: "Mobile verification is not configured. Please try again later."
            });
        }

        const now = Date.now();

        // Prevent repeatedly generating OTPs.
        const latestChallenge = db.prepare(`
            SELECT created_at
            FROM otp_challenges
            WHERE citizen_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(citizen.id);

        if (
            latestChallenge &&
            now - latestChallenge.created_at < RESEND_COOLDOWN_MS
        ) {
            return res.status(429).json({
                success: false,
                message: "Please wait 30 seconds before requesting another OTP."
            });
        }

        const otp = crypto.randomInt(0, 1000000)
            .toString()
            .padStart(6, "0");

        const expiresAt = now + OTP_EXPIRY_MS;

        // Invalidate previous outstanding challenges.
        db.prepare(`
            UPDATE otp_challenges
            SET consumed = 1
            WHERE citizen_id = ? AND consumed = 0
        `).run(citizen.id);

        db.prepare(`
            INSERT INTO otp_challenges (
                citizen_id,
                otp_hash,
                expires_at,
                attempts,
                consumed,
                created_at
            )
            VALUES (?, ?, ?, 0, 0, ?)
        `).run(
            citizen.id,
            hashOTP(otp),
            expiresAt,
            now
        );

        return res.status(200).json({
            success: true,
            requiresOTP: true,
            message: "Development OTP created. No SMS was sent.",
            developmentOnly: true,
            developmentOTP: otp,
            mobile: citizen.mobile
        });

    } catch (error) {
        console.error("Citizen login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in right now. Please try again."
        });
    }
};

// ========================================
// VERIFY CITIZEN OTP
// ========================================

const verifyCitizenOTP = async (req, res) => {
    try {
        if (!isDevelopmentOTPEnabled()) {
            return res.status(503).json({
                success: false,
                message: "OTP verification is not configured."
            });
        }

        const { mobile, otp } = req.body;

        if (
            !isValidMobile(mobile) ||
            typeof otp !== "string" ||
            !/^\d{6}$/.test(otp)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter your registered mobile number and six-digit OTP."
            });
        }

        const citizen = db.prepare(`
            SELECT id, full_name, mobile, email, phone_verified
            FROM citizens
            WHERE mobile = ?
        `).get(mobile);

        if (!citizen) {
            return res.status(400).json({
                success: false,
                message: "The verification request is invalid or expired."
            });
        }

        if (citizen.phone_verified === 1) {
            return res.status(409).json({
                success: false,
                message: "This mobile number has already been verified. Please sign in."
            });
        }

        const challenge = db.prepare(`
            SELECT id, otp_hash, expires_at, attempts, consumed
            FROM otp_challenges
            WHERE citizen_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(citizen.id);

        if (
            !challenge ||
            challenge.consumed === 1 ||
            Date.now() > challenge.expires_at
        ) {
            return res.status(400).json({
                success: false,
                message: "Your OTP has expired or is invalid. Please sign in again."
            });
        }

        if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
            db.prepare(`
                UPDATE otp_challenges
                SET consumed = 1
                WHERE id = ?
            `).run(challenge.id);

            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please sign in again."
            });
        }

        if (hashOTP(otp) !== challenge.otp_hash) {
            const attempts = challenge.attempts + 1;

            db.prepare(`
                UPDATE otp_challenges
                SET attempts = ?,
                    consumed = CASE
                        WHEN ? >= ? THEN 1
                        ELSE consumed
                    END
                WHERE id = ?
            `).run(
                attempts,
                attempts,
                MAX_OTP_ATTEMPTS,
                challenge.id
            );

            return res.status(400).json({
                success: false,
                message: attempts >= MAX_OTP_ATTEMPTS
                    ? "Too many incorrect attempts. Please sign in again."
                    : `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`
            });
        }

        // Consume OTP and verify phone in one transaction.
        const verifyTransaction = db.transaction(() => {
            db.prepare(`
                UPDATE otp_challenges
                SET consumed = 1
                WHERE id = ?
            `).run(challenge.id);

            db.prepare(`
                UPDATE citizens
                SET phone_verified = 1
                WHERE id = ?
            `).run(citizen.id);
        });

        verifyTransaction();

        const token = createLoginToken(citizen);

        return res.status(200).json({
            success: true,
            message: "Mobile verification successful. Welcome to StraySync!",
            token,
            citizen: {
                id: citizen.id,
                fullName: citizen.full_name,
                mobile: citizen.mobile,
                email: citizen.email
            }
        });

    } catch (error) {
        console.error("OTP verification error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your OTP right now. Please try again."
        });
    }
};

// ========================================
// RESEND OTP
// ========================================

const resendCitizenOTP = async (req, res) => {
    // Reuse login challenge creation logic.
    // The citizen must provide their mobile number and password again.
    return loginCitizen(req, res);
};

// ========================================
// GET LOGGED-IN CITIZEN PROFILE
// ========================================

const getCitizenProfile = (req, res) => {
    try {
        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                mobile,
                email,
                address
            FROM citizens
            WHERE id = ?
        `).get(req.citizen.id);

        if (!citizen) {
            return res.status(404).json({
                success: false,
                message: "Citizen profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: citizen.id,
                fullName: citizen.full_name,
                phone: citizen.mobile,
                email: citizen.email || "",
                address: citizen.address || ""
            }
        });

    } catch (error) {
        console.error("Get citizen profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load your profile."
        });
    }
};

// ========================================
// UPDATE LOGGED-IN CITIZEN PROFILE
// ========================================

const updateCitizenProfile = (req, res) => {
    try {
        const { fullName, email, address } = req.body;

        // Validate full name.
        if (
            typeof fullName !== "string" ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a name containing 2 to 100 characters."
            });
        }

        // Validate email.
        if (
            email !== undefined &&
            email !== null &&
            (
                typeof email !== "string" ||
                email.length > 254 ||
                (
                    email.trim() !== "" &&
                    !isValidEmail(email.trim())
                )
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        // Validate address.
        if (
            address !== undefined &&
            (
                typeof address !== "string" ||
                address.length > 500
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Address must be 500 characters or fewer."
            });
        }

        // Update only the authenticated citizen's record.
        const result = db.prepare(`
            UPDATE citizens
            SET
                full_name = ?,
                email = ?,
                address = ?
            WHERE id = ?
        `).run(
            fullName.trim(),
            typeof email === "string" && email.trim()
                ? email.trim()
                : null,
            typeof address === "string"
                ? address.trim()
                : "",
            req.citizen.id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Citizen profile not found."
            });
        }

        // Retrieve the updated profile.
        const citizen = db.prepare(`
            SELECT id, full_name, mobile, email, address
            FROM citizens
            WHERE id = ?
        `).get(req.citizen.id);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                id: citizen.id,
                fullName: citizen.full_name,
                phone: citizen.mobile,
                email: citizen.email || "",
                address: citizen.address || ""
            }
        });

    } catch (error) {
        console.error("Update citizen profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update your profile."
        });
    }
};

// ========================================
// MUNICIPAL OFFICER REGISTRATION
// ========================================

const registerOfficer = async (req, res) => {
    try {
        const {
            fullName,
            employeeId,
            email,
            phone,
            password
        } = req.body;

        // 1. Validate required fields.
        if (
            typeof fullName !== "string" ||
            typeof employeeId !== "string" ||
            typeof email !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        const cleanName = fullName.trim();
        const cleanEmployeeId = employeeId.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        // 2. Validate full name.
        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters."
            });
        }

        // 3. Validate employee ID.
        if (
            cleanEmployeeId.length < 3 ||
            cleanEmployeeId.length > 50 ||
            !/^[a-zA-Z0-9_-]+$/.test(cleanEmployeeId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid employee ID."
            });
        }

        // 4. Validate official email.
        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid official email address."
            });
        }

        // 5. Validate mobile number.
        if (!isValidMobile(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        // 6. Validate password.
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 72 characters."
            });
        }

        // 7. Check for duplicate officer details.
        const existingOfficer = db.prepare(`
            SELECT id
            FROM officers
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
               OR mobile = ?
        `).get(
            cleanEmployeeId,
            cleanEmail,
            cleanPhone
        );

        if (existingOfficer) {
            return res.status(409).json({
                success: false,
                message: "An officer with this employee ID, email or mobile number already exists."
            });
        }

        // 8. Hash the password before storing it.
        const passwordHash = await bcrypt.hash(password, 12);

        // 9. Insert officer.
        // The database default sets account_status to Pending Approval.
        // The registration request cannot choose its own account status.
        const result = db.prepare(`
            INSERT INTO officers (
                full_name,
                employee_id,
                official_email,
                mobile,
                password_hash
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            cleanName,
            cleanEmployeeId,
            cleanEmail,
            cleanPhone,
            passwordHash
        );

        // 10. Return the registration result.
        return res.status(201).json({
            success: true,
            message: "Registration submitted successfully. Your account is awaiting approval.",
            officerId: Number(result.lastInsertRowid),
            accountStatus: "Pending Approval"
        });

    } catch (error) {
        console.error("Officer registration error:", error.message);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "An officer with these details already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register the officer right now."
        });
    }
};
// ========================================
// FIELD STAFF REGISTRATION
// ========================================

const registerStaff = async (req, res) => {
    try {
        const {
            fullName,
            employeeId,
            email,
            phone,
            password
        } = req.body;

        // 1. Check required fields.
        if (
            typeof fullName !== "string" ||
            typeof employeeId !== "string" ||
            typeof email !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        // 2. Clean the input.
        const cleanName = fullName.trim();
        const cleanEmployeeId = employeeId.trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        // 3. Validate the full name.
        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain 2 to 100 characters."
            });
        }

        // 4. Validate the Staff Employee ID.
        if (!/^STF\d{7}$/.test(cleanEmployeeId)) {
            return res.status(400).json({
                success: false,
                message: "Staff ID must use the format STF followed by seven digits."
            });
        }

        // 5. Validate email.
        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // 6. Validate Indian mobile number.
        if (!isValidMobile(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        // 7. Validate password.
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain 8 to 72 characters."
            });
        }

        // 8. Check whether these details already exist.
        const existingStaff = db.prepare(`
            SELECT id
            FROM staff
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
               OR mobile = ?
        `).get(
            cleanEmployeeId,
            cleanEmail,
            cleanPhone
        );

        if (existingStaff) {
            return res.status(409).json({
                success: false,
                message: "A staff account with this employee ID, email, or mobile number already exists."
            });
        }

        // 9. Hash the password before saving it.
        const passwordHash = await bcrypt.hash(password, 12);

        // 10. Save the registration request.
        // The database default sets account_status to Pending Approval.
        const result = db.prepare(`
            INSERT INTO staff (
                full_name,
                employee_id,
                official_email,
                mobile,
                password_hash
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            cleanName,
            cleanEmployeeId,
            cleanEmail,
            cleanPhone,
            passwordHash
        );

        // 11. Send a successful response.
        return res.status(201).json({
            success: true,
            message: "Staff registration submitted successfully. Your account is awaiting administrator approval.",
            staffId: Number(result.lastInsertRowid),
            accountStatus: "Pending Approval"
        });

    } catch (error) {
        console.error("Staff registration error:", error.message);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "A staff account with these details already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register staff right now. Please try again."
        });
    }
};

// ========================================
// MUNICIPAL OFFICER LOGIN
// ========================================

const loginOfficer = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (
            typeof identifier !== "string" ||
            typeof password !== "string" ||
            !identifier.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter your Officer ID or official email and password."
            });
        }

        const cleanIdentifier = identifier.trim();

        // Find officer by employee ID or official email.
        const officer = db.prepare(`
            SELECT
                id,
                full_name,
                employee_id,
                official_email,
                mobile,
                password_hash,
                account_status
            FROM officers
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
        `).get(cleanIdentifier, cleanIdentifier);

        // Check credentials.
        if (
            !officer ||
            !(await bcrypt.compare(password, officer.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Officer ID/email or password."
            });
        }

        // Do not permit unapproved accounts to access the dashboard.
        // Officer approval is not required for this prototype.
// Allow registered officers to log in.

        // Validate JWT configuration.
        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error("JWT_SECRET is missing or too short.");

            return res.status(500).json({
                success: false,
                message: "Authentication is temporarily unavailable."
            });
        }

        // Create an officer-specific token.
        const token = jwt.sign(
            {
                officerId: officer.id,
                role: "officer"
            },
            secret,
            {
                expiresIn: "2h",
                issuer: "straysync"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            officer: {
                id: officer.id,
                fullName: officer.full_name,
                employeeId: officer.employee_id,
                email: officer.official_email,
                accountStatus: officer.account_status
            }
        });

    } catch (error) {
        console.error("Officer login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in right now. Please try again."
        });
    }
};

// ========================================
// RESCUE STAFF LOGIN
// ========================================

// ========================================
// STAFF LOGIN
// ========================================

const loginStaff = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // 1. Validate input.
        if (
            typeof identifier !== "string" ||
            typeof password !== "string" ||
            !identifier.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter your Staff ID or official email and password."
            });
        }

        const cleanIdentifier = identifier.trim();

        // 2. Find the staff account.
        const staff = db.prepare(`
            SELECT
                id,
                full_name,
                employee_id,
                official_email,
                mobile,
                password_hash,
                account_status
            FROM staff
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
        `).get(cleanIdentifier, cleanIdentifier);

        // 3. Verify credentials.
        if (
            !staff ||
            !(await bcrypt.compare(password, staff.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Staff ID/email or password."
            });
        }

        // 4. Check whether the municipal officer approved the account.
        if (staff.account_status !== "Approved") {

            if (staff.account_status === "Pending Approval") {
                return res.status(403).json({
                    success: false,
                    message: "Your account is awaiting municipal officer approval."
                });
            }

            if (staff.account_status === "Rejected") {
                return res.status(403).json({
                    success: false,
                    message: "Your staff account has not been approved. Please contact the municipal officer."
                });
            }

            return res.status(403).json({
                success: false,
                message: "Your staff account is not authorized to log in."
            });
        }

        // 5. Validate JWT configuration.
        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error("JWT_SECRET is missing or too short.");

            return res.status(500).json({
                success: false,
                message: "Authentication is temporarily unavailable."
            });
        }

        // 6. Generate a token only for approved staff.
        const token = jwt.sign(
            {
                staffId: staff.id,
                role: "staff"
            },
            secret,
            {
                expiresIn: "2h",
                issuer: "straysync"
            }
        );

        // 7. Return staff details.
        return res.status(200).json({
            success: true,
            message: "Staff login successful.",
            token,
            staff: {
                id: staff.id,
                fullName: staff.full_name,
                employeeId: staff.employee_id,
                email: staff.official_email,
                mobile: staff.mobile,
                accountStatus: staff.account_status
            }
        });

    } catch (error) {
        console.error("Staff login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in right now. Please try again."
        });
    }
};


// ========================================
// EXPORTS
// ========================================

// ========================================
// EXPORTS
// ========================================

module.exports = {
    registerCitizen,
    loginCitizen,
    verifyCitizenOTP,
    resendCitizenOTP,
    getCitizenProfile,
    updateCitizenProfile,
    registerOfficer,
    registerStaff,
    loginOfficer,
    loginStaff
};
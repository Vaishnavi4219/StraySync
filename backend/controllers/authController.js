
// ========================================
// STRAYSYNC - AUTHENTICATION CONTROLLER
// ========================================

const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { createNotification } = require("../services/notificationService");
const { sendCitizenOTPEmail } = require("../services/emailService");

// ========================================
// CONFIGURATION
// ========================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

const isDevelopmentOTPEnabled = () =>
    process.env.NODE_ENV === "development" &&
    process.env.OTP_MODE === "development";

// Normalize OTP consistently before hashing.
const hashOTP = (otp) => {
    const cleanOTP = String(otp).trim();

    return crypto
        .createHash("sha256")
        .update(cleanOTP, "utf8")
        .digest("hex");
};

const generateOTP = () =>
    crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const isValidMobile = (mobile) =>
    typeof mobile === "string" && /^[6-9]\d{9}$/.test(mobile);

const isValidEmail = (email) =>
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
// CITIZEN EMAIL OTP HELPERS
// ========================================

const createEmailOTPChallenge = (citizenId, otp) => {
    const now = Date.now();

    const transaction = db.transaction(() => {
        // Invalidate all previous unused OTPs.
        db.prepare(`
            UPDATE email_otp_challenges
            SET consumed = 1
            WHERE citizen_id = ? AND consumed = 0
        `).run(citizenId);

        // Store only the hash of the new OTP.
        db.prepare(`
            INSERT INTO email_otp_challenges (
                citizen_id,
                otp_hash,
                expires_at,
                attempts,
                consumed,
                created_at
            )
            VALUES (?, ?, ?, 0, 0, ?)
        `).run(
            citizenId,
            hashOTP(otp),
            now + OTP_EXPIRY_MS,
            now
        );
    });

    transaction();
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
            typeof email !== "string" ||
            email.trim().length > 254 ||
            !isValidEmail(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid email address is required."
            });
        }

        const cleanName = fullName.trim();
        const cleanEmail = email.trim().toLowerCase();

        const existingMobile = db.prepare(`
            SELECT id FROM citizens WHERE mobile = ?
        `).get(mobile);

        if (existingMobile) {
            return res.status(409).json({
                success: false,
                message: "This mobile number is already registered. Please sign in."
            });
        }

        const existingEmail = db.prepare(`
            SELECT id
            FROM citizens
            WHERE LOWER(TRIM(email)) = ?
        `).get(cleanEmail);

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered. Please sign in."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const otp = generateOTP();

        const registrationTransaction = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO citizens (
                    full_name,
                    mobile,
                    email,
                    password_hash,
                    phone_verified,
                    email_verified
                )
                VALUES (?, ?, ?, ?, 0, 0)
            `).run(
                cleanName,
                mobile,
                cleanEmail,
                passwordHash
            );

            const citizenId = Number(result.lastInsertRowid);

            db.prepare(`
                INSERT INTO email_otp_challenges (
                    citizen_id,
                    otp_hash,
                    expires_at,
                    attempts,
                    consumed,
                    created_at
                )
                VALUES (?, ?, ?, 0, 0, ?)
            `).run(
                citizenId,
                hashOTP(otp),
                Date.now() + OTP_EXPIRY_MS,
                Date.now()
            );

            return citizenId;
        });

        const citizenId = registrationTransaction();

        try {
            await sendCitizenOTPEmail(
                cleanEmail,
                cleanName,
                otp
            );
        } catch (emailError) {
            console.error(
                "Citizen OTP email error:",
                emailError.message
            );

            return res.status(502).json({
                success: false,
                citizenId,
                email: cleanEmail,
                requiresEmailVerification: true,
                message: "Your account was created, but the verification email could not be sent. Please request a new OTP."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Registration successful. Check your email for the verification OTP.",
            citizenId,
            email: cleanEmail,
            requiresEmailVerification: true
        });

    } catch (error) {
        console.error(
            "Citizen registration error:",
            error.message
        );

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "This email address or mobile number is already registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register right now. Please try again."
        });
    }
};

// ========================================
// CITIZEN LOGIN
// MOBILE NUMBER + PASSWORD
// ========================================

// ========================================
// CITIZEN LOGIN
// EMAIL + PASSWORD
// ========================================

const loginCitizen = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            !isValidEmail(email.trim()) ||
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address and password."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                mobile,
                email,
                password_hash,
                email_verified
            FROM citizens
            WHERE LOWER(TRIM(email)) = ?
        `).get(cleanEmail);

        if (
            !citizen ||
            !(await bcrypt.compare(password, citizen.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email address or password."
            });
        }

        // Email verification is required for citizen login.
        if (citizen.email_verified !== 1) {
            return res.status(403).json({
                success: false,
                requiresEmailVerification: true,
                email: citizen.email,
                message: "Please verify your email address before signing in."
            });
        }

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

    } catch (error) {
        console.error("Citizen login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in right now. Please try again."
        });
    }
};
// ========================================
// VERIFY CITIZEN EMAIL OTP
// ========================================

const verifyCitizenEmailOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const enteredOTP =
            typeof otp === "string" ? otp.trim() : "";

        if (
            typeof email !== "string" ||
            !isValidEmail(email.trim()) ||
            !/^\d{6}$/.test(enteredOTP)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address and six-digit OTP."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                mobile,
                email,
                email_verified
            FROM citizens
            WHERE LOWER(TRIM(email)) = ?
        `).get(cleanEmail);

        if (!citizen) {
            return res.status(400).json({
                success: false,
                message: "The verification request is invalid or expired."
            });
        }

        if (citizen.email_verified === 1) {
            return res.status(409).json({
                success: false,
                message: "Your email is already verified. Please sign in."
            });
        }

        // Always retrieve the newest OTP challenge.
        const challenge = db.prepare(`
            SELECT
                id,
                otp_hash,
                expires_at,
                attempts,
                consumed
            FROM email_otp_challenges
            WHERE citizen_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(citizen.id);

        if (!challenge || challenge.consumed === 1) {
            return res.status(400).json({
                success: false,
                message: "Your OTP is invalid. Please request a new OTP."
            });
        }

        if (Date.now() > challenge.expires_at) {
            db.prepare(`
                UPDATE email_otp_challenges
                SET consumed = 1
                WHERE id = ?
            `).run(challenge.id);

            return res.status(400).json({
                success: false,
                message: "Your OTP has expired. Please request a new OTP."
            });
        }

        if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
            db.prepare(`
                UPDATE email_otp_challenges
                SET consumed = 1
                WHERE id = ?
            `).run(challenge.id);

            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please request a new OTP."
            });
        }

        // Compare normalized OTP hashes.
        const enteredHash = hashOTP(enteredOTP);
        const otpMatches = enteredHash === challenge.otp_hash;

        // Safe diagnostic information. Never log OTP or its hash.
        console.log("EMAIL OTP DEBUG:", {
            citizenId: citizen.id,
            challengeId: challenge.id,
            attempts: challenge.attempts,
            consumed: challenge.consumed,
            expired: Date.now() > challenge.expires_at,
            enteredOTPLength: enteredOTP.length
        });

        console.log("OTP HASH MATCH:", otpMatches);

        if (!otpMatches) {
            const attempts = challenge.attempts + 1;

            db.prepare(`
                UPDATE email_otp_challenges
                SET
                    attempts = ?,
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
                    ? "Too many incorrect attempts. Please request a new OTP."
                    : `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`
            });
        }

        // Mark the OTP as used and verify the email.
        const verifyTransaction = db.transaction(() => {
            const result = db.prepare(`
                UPDATE email_otp_challenges
                SET consumed = 1
                WHERE id = ?
                  AND consumed = 0
            `).run(challenge.id);

            if (result.changes !== 1) {
                throw new Error("OTP has already been used.");
            }

            db.prepare(`
                UPDATE citizens
                SET email_verified = 1
                WHERE id = ?
            `).run(citizen.id);
        });

        verifyTransaction();

        const token = createLoginToken(citizen);

        return res.status(200).json({
            success: true,
            message: "Email verified successfully. Welcome to StraySync!",
            token,
            citizen: {
                id: citizen.id,
                fullName: citizen.full_name,
                mobile: citizen.mobile,
                email: citizen.email
            }
        });

    } catch (error) {
        console.error(
            "Email OTP verification error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify your email right now. Please try again."
        });
    }
};

// ========================================
// RESEND CITIZEN EMAIL OTP
// ========================================

const resendCitizenEmailOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (
            typeof email !== "string" ||
            !isValidEmail(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                email,
                email_verified
            FROM citizens
            WHERE LOWER(TRIM(email)) = ?
        `).get(cleanEmail);

        if (!citizen) {
            return res.status(404).json({
                success: false,
                message: "No registration was found for this email address."
            });
        }

        if (citizen.email_verified === 1) {
            return res.status(409).json({
                success: false,
                message: "Your email is already verified. Please sign in."
            });
        }

        const now = Date.now();

        const latestChallenge = db.prepare(`
            SELECT created_at
            FROM email_otp_challenges
            WHERE citizen_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(citizen.id);

        if (
            latestChallenge &&
            now - latestChallenge.created_at < RESEND_COOLDOWN_MS
        ) {
            const remainingSeconds = Math.ceil(
                (
                    RESEND_COOLDOWN_MS -
                    (now - latestChallenge.created_at)
                ) / 1000
            );

            return res.status(429).json({
                success: false,
                retryAfter: remainingSeconds,
                message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`
            });
        }

        const otp = generateOTP();

        // Create a new challenge and invalidate previous challenges.
        createEmailOTPChallenge(citizen.id, otp);

        try {
            await sendCitizenOTPEmail(
                cleanEmail,
                citizen.full_name,
                otp
            );
        } catch (emailError) {
            console.error(
                "Resend email OTP error:",
                emailError.message
            );

            return res.status(502).json({
                success: false,
                message: "Unable to send the OTP email. Please try again later."
            });
        }

        return res.status(200).json({
            success: true,
            message: "A new verification OTP has been sent to your email."
        });

    } catch (error) {
        console.error(
            "Resend email OTP error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to resend the OTP. Please try again."
        });
    }
};

// ========================================
// OLD MOBILE OTP FUNCTIONS
// RETAINED FOR COMPATIBILITY
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
            SELECT
                id,
                full_name,
                mobile,
                email,
                phone_verified
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
            SELECT
                id,
                otp_hash,
                expires_at,
                attempts,
                consumed
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
                SET
                    attempts = ?,
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

        const transaction = db.transaction(() => {
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

        transaction();

        const token = createLoginToken(citizen);

        return res.status(200).json({
            success: true,
            message: "Mobile verification successful.",
            token,
            citizen: {
                id: citizen.id,
                fullName: citizen.full_name,
                mobile: citizen.mobile,
                email: citizen.email
            }
        });

    } catch (error) {
        console.error(
            "Old mobile OTP verification error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify your OTP right now."
        });
    }
};

const resendCitizenOTP = async (req, res) => {
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

        if (
            email !== undefined &&
            email !== null &&
            (
                typeof email !== "string" ||
                email.length > 254 ||
                (email.trim() !== "" && !isValidEmail(email.trim()))
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

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

        const cleanEmail =
            typeof email === "string" && email.trim()
                ? email.trim().toLowerCase()
                : null;

        // Prevent changing to another citizen's email.
        if (cleanEmail) {
            const existingEmail = db.prepare(`
                SELECT id
                FROM citizens
                WHERE LOWER(TRIM(email)) = ?
                  AND id != ?
            `).get(cleanEmail, req.citizen.id);

            if (existingEmail) {
                return res.status(409).json({
                    success: false,
                    message: "This email address is already used by another account."
                });
            }
        }

        // Do not silently mark a changed email as verified.
        const currentCitizen = db.prepare(`
            SELECT email
            FROM citizens
            WHERE id = ?
        `).get(req.citizen.id);

        if (!currentCitizen) {
            return res.status(404).json({
                success: false,
                message: "Citizen profile not found."
            });
        }

        const oldEmail = (currentCitizen.email || "").trim().toLowerCase();
        const emailChanged = cleanEmail !== oldEmail;

        if (emailChanged && cleanEmail) {
            return res.status(400).json({
                success: false,
                message: "Email changes require a new verification process. Please contact support."
            });
        }

        const result = db.prepare(`
            UPDATE citizens
            SET
                full_name = ?,
                address = ?
            WHERE id = ?
        `).run(
            fullName.trim(),
            typeof address === "string" ? address.trim() : "",
            req.citizen.id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Citizen profile not found."
            });
        }

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

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters."
            });
        }

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

        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid official email address."
            });
        }

        if (!isValidMobile(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 72 characters."
            });
        }

        const existingOfficer = db.prepare(`
            SELECT id
            FROM officers
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
               OR mobile = ?
        `).get(cleanEmployeeId, cleanEmail, cleanPhone);

        if (existingOfficer) {
            return res.status(409).json({
                success: false,
                message: "An officer with this employee ID, email or mobile number already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

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
        const cleanEmployeeId = employeeId.trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters."
            });
        }

        if (!/^STF\d{7}$/.test(cleanEmployeeId)) {
            return res.status(400).json({
                success: false,
                message: "Staff ID must use the format STF followed by seven digits."
            });
        }

        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (!isValidMobile(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain 8 to 72 characters."
            });
        }

        const existingStaff = db.prepare(`
            SELECT id
            FROM staff
            WHERE LOWER(employee_id) = LOWER(?)
               OR LOWER(official_email) = LOWER(?)
               OR mobile = ?
        `).get(cleanEmployeeId, cleanEmail, cleanPhone);

        if (existingStaff) {
            return res.status(409).json({
                success: false,
                message: "A staff account with this employee ID, email, or mobile number already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

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

        // Notify all registered Municipal Officers.
        try {
            const officers = db.prepare(`
                SELECT id FROM officers
            `).all();

            officers.forEach((officer) => {
                createNotification(
                    officer.id,
                    "officer",
                    "New Rescue Staff Registration",
                    `${cleanName} (${cleanEmployeeId}) has submitted a registration request. Please review it.`,
                    "staff_registration",
                    Number(result.lastInsertRowid)
                );
            });

        } catch (notificationError) {
            console.error(
                "Staff registration notification error:",
                notificationError.message
            );
        }

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

        if (
            !officer ||
            !(await bcrypt.compare(password, officer.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Officer ID/email or password."
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error("JWT_SECRET is missing or too short.");

            return res.status(500).json({
                success: false,
                message: "Authentication is temporarily unavailable."
            });
        }

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
// STAFF LOGIN
// ========================================

const loginStaff = async (req, res) => {
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
                message: "Enter your Staff ID or official email and password."
            });
        }

        const cleanIdentifier = identifier.trim();

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

        if (
            !staff ||
            !(await bcrypt.compare(password, staff.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Staff ID/email or password."
            });
        }

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

        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error("JWT_SECRET is missing or too short.");

            return res.status(500).json({
                success: false,
                message: "Authentication is temporarily unavailable."
            });
        }

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

module.exports = {
    registerCitizen,
    loginCitizen,
    verifyCitizenEmailOTP,
    resendCitizenEmailOTP,

    // Old mobile OTP routes retained.
    verifyCitizenOTP,
    resendCitizenOTP,

    getCitizenProfile,
    updateCitizenProfile,

    registerOfficer,
    registerStaff,

    loginOfficer,
    loginStaff
};


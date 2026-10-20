// ============================================
// STRAYSYNC - MUNICIPAL OFFICER AUTHENTICATION
// ============================================

const jwt = require("jsonwebtoken");
const db = require("../config/database");

// ============================================
// VERIFY MUNICIPAL OFFICER TOKEN
// ============================================

const authenticateOfficer = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Check whether the Authorization header exists.
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in as a municipal officer."
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing."
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error("JWT_SECRET is missing or too short.");

            return res.status(500).json({
                success: false,
                message: "Authentication is not configured correctly."
            });
        }

        // Verify the token signature, expiry and issuer.
        const decoded = jwt.verify(token, secret, {
            issuer: "straysync"
        });

        // Accept only tokens issued to municipal officers.
        if (
            decoded.role !== "officer" ||
            !Number.isSafeInteger(decoded.officerId) ||
            decoded.officerId <= 0
        ) {
            return res.status(403).json({
                success: false,
                message: "Municipal officer access is required."
            });
        }

        // Confirm the officer still exists and is active.
        const officer = db.prepare(`
            SELECT id, full_name, employee_id, account_status
            FROM officers
            WHERE id = ?
        `).get(decoded.officerId);

        if (!officer || officer.account_status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your officer account is inactive or unavailable."
            });
        }

        // Attach the authenticated officer to the request.
        req.officer = {
            id: officer.id,
            fullName: officer.full_name,
            employeeId: officer.employee_id,
            role: "officer"
        };

        next();

    } catch (error) {
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Your session is invalid or expired. Please log in again."
            });
        }

        console.error("Officer authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your officer account."
        });
    }
};

// ============================================
// EXPORT
// ============================================

module.exports = {
    authenticateOfficer
};
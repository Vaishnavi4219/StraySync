// ============================================
// STRAYSYNC - AUTHENTICATION MIDDLEWARE
// ============================================

const jwt = require("jsonwebtoken");

// ============================================
// VERIFY CITIZEN TOKEN
// ============================================

const authenticateCitizen = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in to submit an animal report."
            });
        }

        const token = authHeader.split(" ")[1];
        const secret = process.env.JWT_SECRET;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing."
            });
        }

        if (!secret || secret.length < 32) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured correctly."
            });
        }

        const decoded = jwt.verify(token, secret, {
            issuer: "straysync"
        });

        if (
            decoded.role !== "citizen" ||
            !Number.isSafeInteger(decoded.citizenId) ||
            decoded.citizenId <= 0
        ) {
            return res.status(403).json({
                success: false,
                message: "A valid citizen account is required."
            });
        }

        req.citizen = {
            id: decoded.citizenId,
            role: decoded.role
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

        console.error("Citizen authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your account right now."
        });
    }
};

// ============================================
// VERIFY MUNICIPAL OFFICER TOKEN
// ============================================

const authenticateOfficer = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in with your officer account."
            });
        }

        const token = authHeader.split(" ")[1];
        const secret = process.env.JWT_SECRET;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing."
            });
        }

        if (!secret || secret.length < 32) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured correctly."
            });
        }

        const decoded = jwt.verify(token, secret, {
            issuer: "straysync"
        });

        if (
            decoded.role !== "officer" ||
            !Number.isSafeInteger(decoded.officerId) ||
            decoded.officerId <= 0
        ) {
            return res.status(403).json({
                success: false,
                message: "A valid municipal officer account is required."
            });
        }

        req.officer = {
            id: decoded.officerId,
            role: decoded.role
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
                message: "Your officer session is invalid or expired. Please log in again."
            });
        }

        console.error("Officer authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your officer account right now."
        });
    }
};

// ============================================
// VERIFY RESCUE STAFF TOKEN
// ============================================

const authenticateStaff = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in with your rescue staff account."
            });
        }

        const token = authHeader.split(" ")[1];
        const secret = process.env.JWT_SECRET;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing."
            });
        }

        if (!secret || secret.length < 32) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured correctly."
            });
        }

        const decoded = jwt.verify(token, secret, {
            issuer: "straysync"
        });

        if (
            decoded.role !== "staff" ||
            !Number.isSafeInteger(decoded.staffId) ||
            decoded.staffId <= 0
        ) {
            return res.status(403).json({
                success: false,
                message: "A valid rescue staff account is required."
            });
        }

        req.staff = {
            id: decoded.staffId,
            role: decoded.role
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
                message: "Your staff session is invalid or expired. Please log in again."
            });
        }

        console.error("Staff authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your staff account right now."
        });
    }
};



// ============================================
// EXPORT MIDDLEWARE
// ============================================

module.exports = {
    authenticateCitizen,
    authenticateOfficer,
    authenticateStaff
};
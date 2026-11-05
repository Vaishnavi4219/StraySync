// ========================================
// STRAYSYNC - AUTHENTICATION ROUTES
// ========================================

const express = require("express");
const router = express.Router();

const {
    registerCitizen,
    loginCitizen,

    // Email OTP
    verifyCitizenEmailOTP,
    resendCitizenEmailOTP,

    // Old mobile OTP routes
    verifyCitizenOTP,
    resendCitizenOTP,

    getCitizenProfile,
    updateCitizenProfile,

    registerOfficer,
    loginOfficer,

    registerStaff,
    loginStaff

} = require("../controllers/authController");

const {
    authenticateCitizen
} = require("../middleware/authMiddleware");

// ========================================
// CITIZEN AUTHENTICATION
// ========================================

router.post("/citizen/register", registerCitizen);

router.post("/citizen/login", loginCitizen);

// New email OTP routes
router.post("/citizen/verify-email-otp", verifyCitizenEmailOTP);

router.post("/citizen/resend-email-otp", resendCitizenEmailOTP);

// Old mobile OTP routes retained for compatibility
router.post("/citizen/verify-otp", verifyCitizenOTP);

router.post("/citizen/resend-otp", resendCitizenOTP);

// ========================================
// CITIZEN PROFILE
// ========================================

router.get("/me", authenticateCitizen, getCitizenProfile);

router.put("/profile", authenticateCitizen, updateCitizenProfile);

// ========================================
// MUNICIPAL OFFICER AUTHENTICATION
// ========================================

router.post("/officer/register", registerOfficer);

router.post("/officer/login", loginOfficer);

// ========================================
// RESCUE STAFF AUTHENTICATION
// ========================================

router.post("/staff/register", registerStaff);

router.post("/staff/login", loginStaff);

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;
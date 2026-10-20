// ========================================
// STRAYSYNC - AUTHENTICATION ROUTES
// ========================================

const express = require("express");
const router = express.Router();

const {
    registerCitizen,
    loginCitizen,
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

module.exports = router;
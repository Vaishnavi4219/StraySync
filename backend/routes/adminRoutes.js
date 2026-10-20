// ========================================
// STRAYSYNC - ADMIN ROUTES
// ========================================

const express = require("express");
const router = express.Router();

const {
    authenticateOfficer
} = require("../middleware/authMiddleware");

const {
    getStaffAccounts,
    approveStaff
} = require("../controllers/adminController");

// View staff accounts.
router.get("/staff", authenticateOfficer, getStaffAccounts);

// Approve a staff account.
router.patch(
    "/staff/:staffId/approve",
    authenticateOfficer,
    approveStaff
);

module.exports = router;
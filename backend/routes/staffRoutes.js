// ============================================
// STRAYSYNC - RESCUE STAFF ROUTES
// ============================================

const express = require("express");
const router = express.Router();

const { authenticateStaff } =
    require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const {
    getMyAssignments,
    submitResolutionReport,
    getMyResolutionReport
} = require("../controllers/staffController");

// Get assignments for logged-in staff
router.get(
    "/assignments",
    authenticateStaff,
    getMyAssignments
);

// Get the report for an assigned complaint
router.get(
    "/assignments/:complaintId/report",
    authenticateStaff,
    getMyResolutionReport
);

// Submit a rescue completion report with an optional evidence photo
router.post(
    "/assignments/:complaintId/report",
    authenticateStaff,
    (req, res, next) => {
        upload.single("evidencePhoto")(req, res, (error) => {
            if (error) {
                return res.status(400).json({
                    success: false,
                    message:
                        error.message ||
                        "Unable to upload the evidence photo."
                });
            }

            next();
        });
    },
    submitResolutionReport
);

module.exports = router;
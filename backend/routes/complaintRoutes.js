// ============================================
// STRAYSYNC - COMPLAINT ROUTES
// ============================================

const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
    authenticateCitizen,
    authenticateOfficer
} = require("../middleware/authMiddleware");

const {
    createComplaint,
    getMyComplaints,
    getAllComplaints,
    getAssignableComplaints,
    assignComplaint
} = require("../controllers/complaintController");


// ============================================
// MUNICIPAL OFFICER ROUTES
// ============================================

// Get all complaints for the municipal complaints page
router.get(
    "/",
    authenticateOfficer,
    getAllComplaints
);

// Get pending complaints available for staff assignment
router.get(
    "/assignable",
    authenticateOfficer,
    getAssignableComplaints
);

// Assign a complaint to an approved rescue staff member
router.post(
    "/:complaintId/assign",
    authenticateOfficer,
    assignComplaint
);


// ============================================
// CITIZEN ROUTES
// ============================================

// Submit a new animal complaint with a photograph
router.post("/", authenticateCitizen, (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message ||
                    "Unable to upload the photograph."
            });
        }

        next();
    });
}, createComplaint);


// Get complaints submitted by the logged-in citizen
router.get(
    "/my",
    authenticateCitizen,
    getMyComplaints
);


module.exports = router;
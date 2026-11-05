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
assignComplaint,
getCitizenResolutionReport,
submitCitizenFeedback
} = require("../controllers/complaintController");

// ============================================
// MUNICIPAL OFFICER ROUTES
// ============================================

// Get all complaints
router.get(
"/",
authenticateOfficer,
getAllComplaints
);

// Get complaints available for assignment
router.get(
"/assignable",
authenticateOfficer,
getAssignableComplaints
);

// Assign complaint to rescue staff
router.post(
"/:complaintId/assign",
authenticateOfficer,
assignComplaint
);

// ============================================
// CITIZEN ROUTES
// ============================================

// Submit a new animal complaint
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

// Get complaints submitted by logged-in citizen
router.get(
"/my",
authenticateCitizen,
getMyComplaints
);

// ============================================
// CITIZEN RESOLUTION AND FEEDBACK ROUTES
// ============================================

// View rescue completion report
router.get(
"/:complaintId/resolution",
authenticateCitizen,
getCitizenResolutionReport
);

// Submit feedback about rescue completion
router.post(
"/:complaintId/feedback",
authenticateCitizen,
submitCitizenFeedback
);

module.exports = router;

const express = require("express");
const router = express.Router();

const { authenticateOfficer } =
    require("../middleware/authMiddleware");

const {
    getPendingReports,
    reviewReport
} = require("../controllers/verificationController");

router.get("/reports", authenticateOfficer, getPendingReports);

router.patch(
    "/reports/:reportId/review",
    authenticateOfficer,
    reviewReport
);

module.exports = router;
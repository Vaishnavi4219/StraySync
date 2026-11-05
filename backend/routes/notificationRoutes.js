const express = require("express");
const router = express.Router();

const {
    authenticateCitizen,
    authenticateOfficer,
    authenticateStaff
} = require("../middleware/authMiddleware");

const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} = require("../controllers/notificationController");

// Citizen notification routes
router.get("/citizen", authenticateCitizen, getNotifications);
router.get("/citizen/unread-count", authenticateCitizen, getUnreadCount);
router.patch("/citizen/read-all", authenticateCitizen, markAllAsRead);
router.patch("/citizen/:notificationId/read", authenticateCitizen, markAsRead);

// Officer notification routes
router.get("/officer", authenticateOfficer, getNotifications);
router.get("/officer/unread-count", authenticateOfficer, getUnreadCount);
router.patch("/officer/read-all", authenticateOfficer, markAllAsRead);
router.patch("/officer/:notificationId/read", authenticateOfficer, markAsRead);

// Staff notification routes
router.get("/staff", authenticateStaff, getNotifications);
router.get("/staff/unread-count", authenticateStaff, getUnreadCount);
router.patch("/staff/read-all", authenticateStaff, markAllAsRead);
router.patch("/staff/:notificationId/read", authenticateStaff, markAsRead);

module.exports = router;
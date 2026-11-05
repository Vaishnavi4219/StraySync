const db = require("../config/database");

function getUser(req) {
    if (req.citizen) {
        return { id: req.citizen.id, role: "citizen" };
    }

    if (req.officer) {
        return { id: req.officer.id, role: "officer" };
    }

    if (req.staff) {
        return { id: req.staff.id, role: "staff" };
    }

    return null;
}

// Get all notifications
const getNotifications = (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User authentication required."
            });
        }

        const notifications = db.prepare(`
            SELECT *
            FROM notifications
            WHERE recipient_id = ?
            AND recipient_role = ?
            ORDER BY created_at DESC, id DESC
        `).all(user.id, user.role);

        res.json({
            success: true,
            notifications
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch notifications."
        });
    }
};

// Get unread count
const getUnreadCount = (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User authentication required."
            });
        }

        const result = db.prepare(`
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE recipient_id = ?
            AND recipient_role = ?
            AND is_read = 0
        `).get(user.id, user.role);

        res.json({
            success: true,
            unreadCount: result.count
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch unread count."
        });
    }
};

// Mark one notification as read
const markAsRead = (req, res) => {
    try {
        const user = getUser(req);
        const notificationId = Number(req.params.notificationId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User authentication required."
            });
        }

        const result = db.prepare(`
            UPDATE notifications
            SET is_read = 1
            WHERE id = ?
            AND recipient_id = ?
            AND recipient_role = ?
        `).run(notificationId, user.id, user.role);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to update notification."
        });
    }
};

// Mark all notifications as read
const markAllAsRead = (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User authentication required."
            });
        }

        db.prepare(`
            UPDATE notifications
            SET is_read = 1
            WHERE recipient_id = ?
            AND recipient_role = ?
            AND is_read = 0
        `).run(user.id, user.role);

        res.json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to update notifications."
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};
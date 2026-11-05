// ========================================
// STRAYSYNC - NOTIFICATION SERVICE
// ========================================

const db = require("../config/database");
const { getIO } = require("../config/socket");

function createNotification(
    recipientId,
    recipientRole,
    title,
    message,
    notificationType,
    relatedId = null
) {
    // Save notification in database
    const query = db.prepare(`
        INSERT INTO notifications (
            recipient_id,
            recipient_role,
            title,
            message,
            notification_type,
            related_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = query.run(
        recipientId,
        recipientRole,
        title,
        message,
        notificationType,
        relatedId
    );

    const notificationId = Number(result.lastInsertRowid);

    // Get saved notification
    const notification = db.prepare(`
        SELECT *
        FROM notifications
        WHERE id = ?
    `).get(notificationId);

    // Send real-time notification
    try {
        const io = getIO();

        const room = `${recipientRole}_${recipientId}`;

        io.to(room).emit("notification", notification);

        console.log(
            `Real-time notification sent to ${room}`
        );

    } catch (error) {
        console.error(
            "Socket notification error:",
            error.message
        );
    }

    return notificationId;
}

module.exports = { createNotification };
// ========================================
// STRAYSYNC - ADMIN CONTROLLER
// ========================================

const db = require("../config/database");

// ========================================
// GET STAFF ACCOUNTS
// ========================================

const getStaffAccounts = (req, res) => {
    try {
        const staff = db.prepare(`
            SELECT
                id,
                full_name,
                employee_id,
                official_email,
                mobile,
                account_status,
                created_at
            FROM staff
            ORDER BY
                CASE
                    WHEN account_status = 'Pending Approval' THEN 0
                    ELSE 1
                END,
                id DESC
        `).all();

        return res.status(200).json({
            success: true,
            message: "Staff accounts retrieved successfully.",
            staff
        });

    } catch (error) {
        console.error("Get staff accounts error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve staff accounts."
        });
    }
};

// ========================================
// APPROVE STAFF ACCOUNT
// ========================================

const approveStaff = (req, res) => {
    try {
        const staffId = Number(req.params.staffId);

        if (!Number.isSafeInteger(staffId) || staffId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid staff ID."
            });
        }

        const staff = db.prepare(`
            SELECT id, account_status
            FROM staff
            WHERE id = ?
        `).get(staffId);

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff account not found."
            });
        }

        if (staff.account_status === "Approved") {
            return res.status(200).json({
                success: true,
                message: "This staff account is already approved."
            });
        }

        const result = db.prepare(`
            UPDATE staff
            SET account_status = 'Approved'
            WHERE id = ?
              AND account_status = 'Pending Approval'
        `).run(staffId);

        if (result.changes === 0) {
            return res.status(409).json({
                success: false,
                message: "This staff account cannot be approved in its current status."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Staff account approved successfully."
        });

    } catch (error) {
        console.error("Approve staff error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to approve the staff account."
        });
    }
};

module.exports = {
    getStaffAccounts,
    approveStaff
};
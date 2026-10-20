
const db = require("../config/database");

// GET /api/verification/reports
const getPendingReports = (req, res) => {
    try {
        const reports = db.prepare(`
            SELECT
                r.id AS report_id,
                r.complaint_id,
                r.staff_id,
                r.action_description,
                r.evidence_photo,
                r.verification_status,
                r.officer_feedback,
                r.submitted_at,
                r.reviewed_at,
                s.full_name AS staff_name,
                s.employee_id,
                c.animal_type,
                c.category,
                c.description AS complaint_description,
                c.location,
                c.original_photo,
                c.priority,
                c.status AS complaint_status
            FROM resolution_reports r
            JOIN staff s ON s.id = r.staff_id
            JOIN complaints c ON c.id = r.complaint_id
            ORDER BY
                CASE
                    WHEN r.verification_status = 'Pending Verification'
                    THEN 0 ELSE 1
                END,
                r.submitted_at DESC
        `).all();

        res.json({ success: true, reports });
    } catch (error) {
        console.error("Get verification reports error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load rescue reports."
        });
    }
};

// PATCH /api/verification/reports/:reportId/review
const reviewReport = (req, res) => {
    try {
        const reportId = Number(req.params.reportId);
        const { decision, feedback = "" } = req.body;

        if (!Number.isSafeInteger(reportId) || reportId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID."
            });
        }

        if (!["Approved", "Rejected"].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: "Choose Approved or Rejected."
            });
        }

        if (typeof feedback !== "string" || feedback.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Feedback must be 1000 characters or fewer."
            });
        }

        if (decision === "Rejected" && !feedback.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide feedback explaining the rejection."
            });
        }

        const review = db.transaction(() => {
            const report = db.prepare(`
                SELECT id, complaint_id, verification_status
                FROM resolution_reports
                WHERE id = ?
            `).get(reportId);

            if (!report) {
                const error = new Error("REPORT_NOT_FOUND");
                throw error;
            }

            if (report.verification_status !== "Pending Verification") {
                const error = new Error("REPORT_ALREADY_REVIEWED");
                throw error;
            }

            db.prepare(`
                UPDATE resolution_reports
                SET verification_status = ?,
                    officer_feedback = ?,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND verification_status = 'Pending Verification'
            `).run(decision, feedback.trim(), reportId);

            // An approved report resolves the complaint.
            // A rejected report returns it to the assigned-work stage.
            db.prepare(`
                UPDATE complaints
                SET status = ?
                WHERE id = ?
            `).run(
                decision === "Approved" ? "Resolved" : "Assigned",
                report.complaint_id
            );

            return report.complaint_id;
        });

        const complaintId = review();

        return res.json({
            success: true,
            message: `Rescue report ${decision.toLowerCase()} successfully.`,
            complaintId,
            decision
        });
    } catch (error) {
        if (error.message === "REPORT_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Rescue report not found."
            });
        }

        if (error.message === "REPORT_ALREADY_REVIEWED") {
            return res.status(409).json({
                success: false,
                message: "This report has already been reviewed."
            });
        }

        console.error("Review rescue report error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to review the rescue report."
        });
    }
};

module.exports = {
    getPendingReports,
    reviewReport
};
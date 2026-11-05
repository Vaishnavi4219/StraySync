
const db = require("../config/database");
const { createNotification } = require("../services/notificationService");
const {
    sendStaffReviewEmail
} = require("../services/emailService");


// ============================================
// GET /api/verification/reports
// ============================================

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
                s.official_email AS staff_email,

                c.citizen_id,
                c.animal_type,
                c.category,
                c.description AS complaint_description,
                c.location,
                c.original_photo,
                c.priority,
                c.status AS complaint_status,

                f.feedback AS citizen_feedback,
                f.rating AS citizen_rating,
                f.created_at AS feedback_submitted_at

            FROM resolution_reports r

            JOIN staff s
                ON s.id = r.staff_id

            JOIN complaints c
                ON c.id = r.complaint_id

            LEFT JOIN citizen_feedback f
                ON f.report_id = r.id

            ORDER BY
                CASE
                    WHEN r.verification_status = 'Pending Officer Approval'
                    THEN 0
                    ELSE 1
                END,

                r.submitted_at DESC
        `).all();

        return res.json({
            success: true,
            reports
        });

    } catch (error) {

        console.error(
            "Get verification reports error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load rescue reports."
        });
    }
};


// ============================================
// PATCH /api/verification/reports/:reportId/review
// ============================================

const reviewReport = async (req, res) => {
    try {

        const reportId = Number(req.params.reportId);

        const {
            decision,
            feedback = ""
        } = req.body;


        // ============================================
        // VALIDATE REPORT ID
        // ============================================

        if (
            !Number.isSafeInteger(reportId) ||
            reportId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID."
            });
        }


        // ============================================
        // VALIDATE DECISION
        // ============================================

        if (
            !["Approved", "Rejected"].includes(decision)
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose Approved or Rejected."
            });
        }


        // ============================================
        // VALIDATE FEEDBACK
        // ============================================

        if (
            typeof feedback !== "string" ||
            feedback.length > 1000
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Feedback must be 1000 characters or fewer."
            });
        }


        // Rejection requires officer feedback
        if (
            decision === "Rejected" &&
            !feedback.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide feedback explaining the rejection."
            });
        }


        // ============================================
        // REVIEW REPORT TRANSACTION
        // ============================================

        const review = db.transaction(() => {

            const report = db.prepare(`
                SELECT
                    r.id,
                    r.complaint_id,
                    r.staff_id,
                    r.verification_status,

                    s.full_name AS staff_name,
                    s.official_email AS staff_email,

                    c.citizen_id,

                    a.assigned_by

                FROM resolution_reports r

                JOIN complaints c
                    ON c.id = r.complaint_id

                JOIN staff s
                    ON s.id = r.staff_id

                LEFT JOIN assignments a
                    ON a.complaint_id = r.complaint_id

                WHERE r.id = ?
            `).get(reportId);


            // ============================================
            // REPORT NOT FOUND
            // ============================================

            if (!report) {
                throw new Error("REPORT_NOT_FOUND");
            }


            // ============================================
            // REPORT MUST BE READY FOR REVIEW
            // ============================================

            if (
                report.verification_status !==
                "Pending Officer Approval"
            ) {
                throw new Error("REPORT_NOT_READY");
            }


            // ============================================
            // CITIZEN FEEDBACK IS REQUIRED
            // ============================================

            const citizenFeedback = db.prepare(`
                SELECT id
                FROM citizen_feedback
                WHERE report_id = ?
            `).get(reportId);


            if (!citizenFeedback) {
                throw new Error(
                    "CITIZEN_FEEDBACK_REQUIRED"
                );
            }


            // ============================================
            // UPDATE RESOLUTION REPORT
            // ============================================

            db.prepare(`
                UPDATE resolution_reports
                SET
                    verification_status = ?,
                    officer_feedback = ?,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND verification_status =
                      'Pending Officer Approval'
            `).run(
                decision,
                feedback.trim(),
                reportId
            );


            // ============================================
            // UPDATE COMPLAINT STATUS
            // ============================================

            db.prepare(`
                UPDATE complaints
                SET status = ?
                WHERE id = ?
            `).run(
                decision === "Approved"
                    ? "Completed"
                    : "Assigned",

                report.complaint_id
            );


            return report;
        });


        const report = review();


        // ============================================
        // NOTIFY CITIZEN
        // ============================================

        try {

            createNotification(
                report.citizen_id,
                "citizen",

                decision === "Approved"
                    ? "Rescue Work Approved!"
                    : "Rescue Report Needs Changes",

                decision === "Approved"
                    ? `The municipal officer has approved the rescue report for complaint #${report.complaint_id}. Your complaint is now completed.`
                    : `The municipal officer has rejected the rescue report for complaint #${report.complaint_id}. Please check the report status.`,

                "officer_report_review",
                report.complaint_id
            );

        } catch (notificationError) {

            console.error(
                "Citizen notification error:",
                notificationError.message
            );
        }


        // ============================================
        // NOTIFY STAFF INSIDE STRAYSYNC
        // ============================================

        try {

            createNotification(
                report.staff_id,
                "staff",

                decision === "Approved"
                    ? "Rescue Report Approved!"
                    : "Rescue Report Rejected",

                decision === "Approved"
                    ? `Your rescue report for complaint #${report.complaint_id} has been approved by the municipal officer.`
                    : `Your rescue report for complaint #${report.complaint_id} was rejected. Officer feedback: ${feedback.trim()}`,

                "officer_report_review",
                report.complaint_id
            );

        } catch (notificationError) {

            console.error(
                "Staff notification error:",
                notificationError.message
            );
        }


        // ============================================
        // SEND EMAIL TO STAFF
        // ============================================

        try {

            if (
                report.staff_email &&
                report.staff_email.trim() !== ""
            ) {

                await sendStaffReviewEmail(
                    report.staff_email,
                    report.staff_name,
                    report.complaint_id,
                    decision,
                    feedback.trim()
                );

                console.log(
                    `Staff review email sent to ${report.staff_email} for complaint #${report.complaint_id}`
                );

            } else {

                console.log(
                    `Staff email not available for complaint #${report.complaint_id}`
                );
            }

        } catch (emailError) {

            // Email failure must NOT undo
            // the successful officer review.
            console.error(
                "Staff review email error:",
                emailError.message
            );
        }


        // ============================================
        // SUCCESS RESPONSE
        // ============================================

        return res.json({
            success: true,

            message:
                `Rescue report ${decision.toLowerCase()} successfully.`,

            complaintId:
                report.complaint_id,

            decision,

            complaintStatus:
                decision === "Approved"
                    ? "Completed"
                    : "Assigned"
        });


    } catch (error) {


        // ============================================
        // REPORT NOT FOUND
        // ============================================

        if (
            error.message ===
            "REPORT_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Rescue report not found."
            });
        }


        // ============================================
        // REPORT NOT READY
        // ============================================

        if (
            error.message ===
            "REPORT_NOT_READY"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "This report is not waiting for officer approval."
            });
        }


        // ============================================
        // CITIZEN FEEDBACK REQUIRED
        // ============================================

        if (
            error.message ===
            "CITIZEN_FEEDBACK_REQUIRED"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Citizen feedback is required before reviewing this report."
            });
        }


        // ============================================
        // GENERAL ERROR
        // ============================================

        console.error(
            "Review rescue report error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to review the rescue report."
        });
    }
};


// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
    getPendingReports,
    reviewReport
};


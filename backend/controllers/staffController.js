
// ============================================
// STRAYSYNC - STAFF CONTROLLER
// ============================================

const db = require("../config/database");
const { createNotification } = require("../services/notificationService");
const {
    sendRescueCompletionEmail
} = require("../services/emailService");

// ============================================
// GET ASSIGNMENTS FOR LOGGED-IN STAFF
// ============================================

const getMyAssignments = (req, res) => {
    try {
        const staffId = req.staff.id;

        const assignments = db.prepare(`
            SELECT
                a.id AS assignment_id,
                a.assigned_at,
                c.id AS complaint_id,
                c.animal_type,
                c.category,
                c.description,
                c.location,
                c.latitude,
                c.longitude,
                c.original_photo,
                c.priority,
                c.status,
                c.created_at
            FROM assignments a
            INNER JOIN complaints c
                ON c.id = a.complaint_id
            WHERE a.staff_id = ?
            ORDER BY a.assigned_at DESC
        `).all(staffId);

        return res.status(200).json({
            success: true,
            count: assignments.length,
            assignments
        });

    } catch (error) {
        console.error(
            "Get staff assignments error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve assigned complaints."
        });
    }
};

// ============================================
// SUBMIT OR RESUBMIT RESCUE COMPLETION REPORT
// ============================================

const submitResolutionReport = async (req, res) => {
    try {
        const staffId = req.staff.id;
        const complaintId = Number(req.params.complaintId);

        const actionDescription =
            typeof req.body.actionDescription === "string"
                ? req.body.actionDescription.trim()
                : "";

        // ============================================
        // VALIDATE COMPLAINT ID
        // ============================================

        if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        // ============================================
        // VALIDATE RESCUE DESCRIPTION
        // ============================================

        if (
            actionDescription.length < 10 ||
            actionDescription.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Describe the rescue action using 10 to 2000 characters."
            });
        }

        // ============================================
        // CONFIRM COMPLAINT IS ASSIGNED TO THIS STAFF
        // ============================================

        const assignment = db.prepare(`
            SELECT
                a.complaint_id,
                c.citizen_id,
                c.status
            FROM assignments a
            INNER JOIN complaints c
                ON c.id = a.complaint_id
            WHERE a.complaint_id = ?
              AND a.staff_id = ?
        `).get(complaintId, staffId);

        if (!assignment) {
            return res.status(403).json({
                success: false,
                message:
                    "You can submit reports only for complaints assigned to you."
            });
        }

        // ============================================
        // CHECK WHETHER A REPORT ALREADY EXISTS
        // ============================================

        const existingReport = db.prepare(`
            SELECT
                id,
                verification_status
            FROM resolution_reports
            WHERE complaint_id = ?
        `).get(complaintId);

        // ============================================
        // SAVE EVIDENCE PHOTO PATH
        // ============================================

        const evidencePhoto = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        let reportId;
        let isResubmission = false;

        // ============================================
        // SAVE REPORT USING TRANSACTION
        // ============================================

        const submitReportTransaction = db.transaction(() => {

            if (existingReport) {

                // Only rejected reports can be resubmitted
                if (
                    existingReport.verification_status !== "Rejected"
                ) {
                    throw new Error("REPORT_ALREADY_SUBMITTED");
                }

                // Remove previous citizen feedback.
                // Citizen must review the corrected report again.
                db.prepare(`
                    DELETE FROM citizen_feedback
                    WHERE report_id = ?
                `).run(existingReport.id);

                // Update existing report
                db.prepare(`
                    UPDATE resolution_reports
                    SET
                        action_description = ?,
                        evidence_photo = COALESCE(?, evidence_photo),
                        verification_status = 'Awaiting Citizen Feedback',
                        submitted_at = CURRENT_TIMESTAMP,
                        reviewed_at = NULL
                    WHERE id = ?
                `).run(
                    actionDescription,
                    evidencePhoto,
                    existingReport.id
                );

                reportId = existingReport.id;
                isResubmission = true;

            } else {

                // First report submission
                const result = db.prepare(`
                    INSERT INTO resolution_reports (
                        complaint_id,
                        staff_id,
                        action_description,
                        evidence_photo,
                        verification_status
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        'Awaiting Citizen Feedback'
                    )
                `).run(
                    complaintId,
                    staffId,
                    actionDescription,
                    evidencePhoto
                );

                reportId = Number(result.lastInsertRowid);
            }

            // Update complaint status
            db.prepare(`
                UPDATE complaints
                SET status = 'Awaiting Citizen Feedback'
                WHERE id = ?
            `).run(complaintId);
        });

        // Execute transaction
        submitReportTransaction();

        // ============================================
        // CREATE IN-APP NOTIFICATION FOR CITIZEN
        // ============================================

        try {
            createNotification(
                assignment.citizen_id,
                "citizen",

                isResubmission
                    ? "Rescue Report Updated!"
                    : "Rescue Report Submitted!",

                isResubmission
                    ? `Rescue staff have updated the report for complaint #${complaintId}. Please review the updated report and submit your feedback again.`
                    : `Rescue staff have submitted a completion report for complaint #${complaintId}. Please review the report and submit your feedback.`,

                "resolution_report_submitted",
                complaintId
            );

        } catch (notificationError) {

            console.error(
                "Citizen notification error:",
                notificationError.message
            );
        }

        // ============================================
        // SEND EMAIL TO CITIZEN
        // ============================================

        try {

            const citizen = db.prepare(`
                SELECT
                    full_name,
                    email
                FROM citizens
                WHERE id = ?
            `).get(assignment.citizen_id);

            if (
                citizen &&
                typeof citizen.email === "string" &&
                citizen.email.trim() !== ""
            ) {

                await sendRescueCompletionEmail(
                    citizen.email,
                    citizen.full_name,
                    complaintId
                );

                console.log(
                    `Rescue completion email sent to ${citizen.email} for complaint #${complaintId}`
                );

            } else {

                console.log(
                    `Citizen email not available for complaint #${complaintId}`
                );
            }

        } catch (emailError) {

            // Email failure must NOT undo
            // the successful rescue report submission.
            console.error(
                "Rescue completion email error:",
                emailError.message
            );
        }

        // ============================================
        // SEND SUCCESS RESPONSE
        // ============================================

        return res.status(
            isResubmission ? 200 : 201
        ).json({
            success: true,

            message: isResubmission
                ? "Rescue report updated successfully. It is now awaiting citizen feedback again."
                : "Rescue report submitted successfully. It is now awaiting citizen feedback.",

            reportId,
            complaintId,

            verificationStatus:
                "Awaiting Citizen Feedback"
        });

    } catch (error) {

        // ============================================
        // HANDLE ALREADY SUBMITTED REPORT
        // ============================================

        if (
            error.message ===
            "REPORT_ALREADY_SUBMITTED"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A report already exists and cannot be resubmitted at this stage."
            });
        }

        // ============================================
        // GENERAL ERROR
        // ============================================

        console.error(
            "Submit rescue report error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to submit the rescue report."
        });
    }
};

// ============================================
// GET REPORT FOR AN ASSIGNED COMPLAINT
// ============================================

const getMyResolutionReport = (req, res) => {
    try {
        const staffId = req.staff.id;
        const complaintId = Number(req.params.complaintId);

        // ============================================
        // VALIDATE COMPLAINT ID
        // ============================================

        if (
            !Number.isSafeInteger(complaintId) ||
            complaintId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        // ============================================
        // VERIFY ASSIGNMENT OWNERSHIP
        // ============================================

        const assignment = db.prepare(`
            SELECT id
            FROM assignments
            WHERE complaint_id = ?
              AND staff_id = ?
        `).get(complaintId, staffId);

        if (!assignment) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot view reports for complaints not assigned to you."
            });
        }

        // ============================================
        // GET RESOLUTION REPORT
        // ============================================

        const report = db.prepare(`
            SELECT
                id,
                complaint_id,
                action_description,
                evidence_photo,
                verification_status,
                officer_feedback,
                submitted_at,
                reviewed_at
            FROM resolution_reports
            WHERE complaint_id = ?
              AND staff_id = ?
        `).get(complaintId, staffId);

        return res.status(200).json({
            success: true,
            report: report || null
        });

    } catch (error) {

        console.error(
            "Get rescue report error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve the rescue report."
        });
    }
};

// ============================================
// EXPORT CONTROLLER FUNCTIONS
// ============================================

module.exports = {
    getMyAssignments,
    submitResolutionReport,
    getMyResolutionReport
};


// ============================================
// STRAYSYNC - STAFF CONTROLLER
// ============================================

const db = require("../config/database");

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
        console.error("Get staff assignments error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve assigned complaints."
        });
    }
};

// ============================================
// SUBMIT RESCUE COMPLETION REPORT
// ============================================

const submitResolutionReport = (req, res) => {
    try {
        const staffId = req.staff.id;
        const complaintId = Number(req.params.complaintId);

        const actionDescription =
            typeof req.body.actionDescription === "string"
                ? req.body.actionDescription.trim()
                : "";

        // Validate complaint ID
        if (
            !Number.isSafeInteger(complaintId) ||
            complaintId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        // Validate rescue description
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

        // Confirm this complaint belongs to the logged-in staff member
        const assignment = db.prepare(`
            SELECT
                a.complaint_id,
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

        // Do not allow a second report for the same complaint
        const existingReport = db.prepare(`
            SELECT id, verification_status
            FROM resolution_reports
            WHERE complaint_id = ?
        `).get(complaintId);

        if (existingReport) {
            return res.status(409).json({
                success: false,
                message:
                    "A rescue report has already been submitted for this complaint.",
                verificationStatus:
                    existingReport.verification_status
            });
        }

        // Save uploaded evidence photo path, if provided
        const evidencePhoto = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // Save the report and update complaint status together
        const submitReportTransaction = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO resolution_reports (
                    complaint_id,
                    staff_id,
                    action_description,
                    evidence_photo,
                    verification_status
                )
                VALUES (?, ?, ?, ?, 'Pending Verification')
            `).run(
                complaintId,
                staffId,
                actionDescription,
                evidencePhoto
            );

            db.prepare(`
                UPDATE complaints
                SET status = 'Pending Verification'
                WHERE id = ?
            `).run(complaintId);

            return result.lastInsertRowid;
        });

        const reportId = submitReportTransaction();

        return res.status(201).json({
            success: true,
            message:
                "Rescue report submitted successfully. It is awaiting municipal officer verification.",
            reportId,
            complaintId,
            verificationStatus: "Pending Verification"
        });

    } catch (error) {
        console.error(
            "Submit rescue report error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to submit the rescue report."
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

        if (
            !Number.isSafeInteger(complaintId) ||
            complaintId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        // Verify assignment ownership before returning report details
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
            message: "Unable to retrieve the rescue report."
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
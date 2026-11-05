// ========================================
// STRAYSYNC - COMPLAINT CONTROLLER
// ========================================

const db = require("../config/database");
const { createNotification } = require("../services/notificationService");
const { sendNewComplaintEmail } = require("../services/emailService");

// ========================================
// CREATE ANIMAL COMPLAINT
// ========================================

const createComplaint = async (req, res) => {
    try {
        const citizenId = req.citizen.id;

        const {
            animalType,
            category,
            description,
            location,
            latitude,
            longitude,
            priority
        } = req.body;

        // Validate required fields
        if (
            typeof animalType !== "string" ||
            typeof category !== "string" ||
            typeof description !== "string" ||
            typeof location !== "string" ||
            !animalType.trim() ||
            !category.trim() ||
            !description.trim() ||
            !location.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        // Get citizen details and email verification status
        const citizen = db.prepare(`
            SELECT
                id,
                full_name,
                mobile,
                email,
                email_verified
            FROM citizens
            WHERE id = ?
        `).get(citizenId);

        // Check email verification
        if (!citizen || Number(citizen.email_verified) !== 1) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before submitting a report."
            });
        }

        // Validate photograph
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an animal photograph."
            });
        }

        // Validate animal type
        const validAnimalTypes = [
            "Dog",
            "Cat",
            "Cow",
            "Buffalo",
            "Goat",
            "Pig",
            "Monkey",
            "Other"
        ];

        if (!validAnimalTypes.includes(animalType)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid animal type."
            });
        }

        // Validate category
        const validCategories = [
            "Medical Emergency",
            "Shelter & Welfare",
            "Public Safety",
            "Stray Animal Management",
            "Other"
        ];

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid complaint category."
            });
        }

        const cleanDescription = description.trim();
        const cleanLocation = location.trim();

        if (
            cleanDescription.length < 10 ||
            cleanDescription.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Description must contain 10 to 2000 characters."
            });
        }

        if (cleanLocation.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Location cannot exceed 500 characters."
            });
        }

        // Validate GPS coordinates
        const parseCoordinate = (value, min, max, name) => {
            if (value === undefined || value === null || value === "") {
                return null;
            }

            const number = Number(value);

            if (
                !Number.isFinite(number) ||
                number < min ||
                number > max
            ) {
                throw new Error(`Invalid ${name} coordinate.`);
            }

            return number;
        };

        let parsedLatitude;
        let parsedLongitude;

        try {
            parsedLatitude = parseCoordinate(
                latitude,
                -90,
                90,
                "latitude"
            );

            parsedLongitude = parseCoordinate(
                longitude,
                -180,
                180,
                "longitude"
            );

        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (
            (parsedLatitude === null) !==
            (parsedLongitude === null)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide both GPS coordinates or leave both empty."
            });
        }

        // Validate priority
        const validPriorities = [
            "Low",
            "Medium",
            "High",
            "Critical"
        ];

        const selectedPriority = validPriorities.includes(priority)
            ? priority
            : "Medium";

        // =====================================
        // SAVE COMPLAINT IN DATABASE
        // =====================================

        const photoPath = `/uploads/${req.file.filename}`;

        const result = db.prepare(`
            INSERT INTO complaints (
                citizen_id,
                animal_type,
                category,
                description,
                location,
                latitude,
                longitude,
                original_photo,
                priority,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            citizenId,
            animalType,
            category,
            cleanDescription,
            cleanLocation,
            parsedLatitude,
            parsedLongitude,
            photoPath,
            selectedPriority,
            "Pending Review"
        );

        const complaintId = Number(result.lastInsertRowid);

        // =====================================
        // SEND EMAIL TO APPROVED OFFICERS
        // =====================================

        try {
            const officers = db.prepare(`
                SELECT official_email
                FROM officers
                WHERE account_status = 'Approved'
                  AND official_email IS NOT NULL
                  AND TRIM(official_email) != ''
            `).all();

            const complaintDetails = {
                id: complaintId,
                citizenName: citizen.full_name,
                mobile: citizen.mobile,
                citizenEmail: citizen.email,
                animalType,
                category,
                description: cleanDescription,
                location: cleanLocation,
                latitude: parsedLatitude,
                longitude: parsedLongitude,
                priority: selectedPriority,
                photoPath
            };

            if (officers.length === 0) {
                console.log(
                    "No approved municipal officers available for email notification."
                );
            } else {
                const emailResults = await Promise.allSettled(
                    officers.map(officer =>
                        sendNewComplaintEmail(
                            officer.official_email,
                            complaintDetails
                        )
                    )
                );

                emailResults.forEach((emailResult, index) => {
                    if (emailResult.status === "rejected") {
                        console.error(
                            `Complaint email failed for officer ${index + 1}:`,
                            emailResult.reason
                        );
                    }
                });

                console.log(
                    `Complaint #${complaintId}: officer email notifications processed.`
                );
            }

        } catch (emailError) {
            // Email failure must not affect complaint submission
            console.error(
                "Officer email notification error:",
                emailError
            );
        }

        // =====================================
        // SUCCESS RESPONSE
        // =====================================

        return res.status(201).json({
            success: true,
            message: "Animal complaint submitted successfully.",
            complaintId,
            status: "Pending Review"
        });

    } catch (error) {
        console.error("Create complaint error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to submit the complaint right now."
        });
    }
};


// ============================================
// GET COMPLAINTS FOR LOGGED-IN CITIZEN
// ============================================

const getMyComplaints = (req, res) => {
    try {
        const citizenId = req.citizen.id;

        const complaints = db.prepare(`
            SELECT
                id,
                animal_type,
                category,
                description,
                location,
                latitude,
                longitude,
                original_photo,
                priority,
                status,
                created_at
            FROM complaints
            WHERE citizen_id = ?
            ORDER BY id DESC
        `).all(citizenId);

        return res.status(200).json({
            success: true,
            count: complaints.length,
            complaints
        });

    } catch (error) {
        console.error("Get citizen complaints error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your complaints right now."
        });
    }
};


// ============================================
// GET ALL COMPLAINTS FOR MUNICIPAL OFFICERS
// ============================================

const getAllComplaints = (req, res) => {
    try {
        const complaints = db.prepare(`
            SELECT
                c.id,
                c.citizen_id,
                c.animal_type,
                c.category,
                c.description,
                c.location,
                c.latitude,
                c.longitude,
                c.original_photo,
                c.priority,
                c.status,
                c.created_at,
                citizens.full_name AS citizen_name,
                citizens.mobile AS citizen_mobile
            FROM complaints c
            LEFT JOIN citizens
                ON citizens.id = c.citizen_id
            ORDER BY c.id DESC
        `).all();

        return res.status(200).json({
            success: true,
            count: complaints.length,
            complaints
        });

    } catch (error) {
        console.error("Get all complaints error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve complaints right now."
        });
    }
};


// ============================================
// GET COMPLAINTS AVAILABLE FOR ASSIGNMENT
// ============================================

const getAssignableComplaints = (req, res) => {
    try {
        const complaints = db.prepare(`
            SELECT
                c.id,
                c.animal_type,
                c.category,
                c.description,
                c.location,
                c.latitude,
                c.longitude,
                c.original_photo,
                c.priority,
                c.status,
                c.created_at,
                citizens.full_name AS citizen_name,
                citizens.mobile AS citizen_mobile
            FROM complaints c
            LEFT JOIN citizens
                ON citizens.id = c.citizen_id
            WHERE LOWER(TRIM(c.status)) = 'pending review'
              AND NOT EXISTS (
                  SELECT 1
                  FROM assignments a
                  WHERE a.complaint_id = c.id
              )
            ORDER BY
                CASE LOWER(c.priority)
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    ELSE 4
                END,
                c.id DESC
        `).all();

        return res.status(200).json({
            success: true,
            count: complaints.length,
            complaints
        });

    } catch (error) {
        console.error("Get assignable complaints error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve complaints available for assignment."
        });
    }
};


// ============================================
// ASSIGN COMPLAINT TO RESCUE STAFF
// ============================================

const assignComplaint = (req, res) => {
    try {
        const complaintId = Number(req.params.complaintId);
        const staffId = Number(req.body.staffId);
        const officerId = req.officer.id;

        if (
            !Number.isSafeInteger(complaintId) ||
            complaintId <= 0 ||
            !Number.isSafeInteger(staffId) ||
            staffId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID or staff ID."
            });
        }

        const assignTransaction = db.transaction(() => {
            const complaint = db.prepare(`
                SELECT id, status
                FROM complaints
                WHERE id = ?
            `).get(complaintId);

            if (!complaint) {
                return {
                    error: 404,
                    message: "Complaint not found."
                };
            }

            if (
                String(complaint.status).trim().toLowerCase() !==
                "pending review"
            ) {
                return {
                    error: 409,
                    message: "This complaint is not awaiting assignment."
                };
            }

            const staff = db.prepare(`
                SELECT id, account_status
                FROM staff
                WHERE id = ?
            `).get(staffId);

            if (!staff) {
                return {
                    error: 404,
                    message: "Rescue staff account not found."
                };
            }

            if (staff.account_status !== "Approved") {
                return {
                    error: 409,
                    message: "Only approved rescue staff can receive assignments."
                };
            }

            const existingAssignment = db.prepare(`
                SELECT id
                FROM assignments
                WHERE complaint_id = ?
            `).get(complaintId);

            if (existingAssignment) {
                return {
                    error: 409,
                    message: "This complaint has already been assigned."
                };
            }

            db.prepare(`
                INSERT INTO assignments (
                    complaint_id,
                    staff_id,
                    assigned_by
                )
                VALUES (?, ?, ?)
            `).run(complaintId, staffId, officerId);

            db.prepare(`
                UPDATE complaints
                SET status = 'Assigned'
                WHERE id = ?
            `).run(complaintId);

            return {
                success: true
            };
        });

        const result = assignTransaction();

        if (result.error) {
            return res.status(result.error).json({
                success: false,
                message: result.message
            });
        }

        // Notify assigned staff
        try {
            createNotification(
                staffId,
                "staff",
                "New Complaint Assigned!",
                `A new animal complaint (#${complaintId}) has been assigned to you. Please check your Staff Dashboard.`,
                "new_assignment",
                complaintId
            );
        } catch (notificationError) {
            console.error(
                "Assignment notification error:",
                notificationError.message
            );
        }

        return res.status(201).json({
            success: true,
            message: "Complaint assigned to rescue staff successfully."
        });

    } catch (error) {
        console.error("Assign complaint error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to assign this complaint."
        });
    }
};


// ============================================
// GET RESOLUTION REPORT FOR CITIZEN
// ============================================

const getCitizenResolutionReport = (req, res) => {
    try {
        const citizenId = req.citizen.id;
        const complaintId = Number(req.params.complaintId);

        if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        const complaint = db.prepare(`
            SELECT id, status
            FROM complaints
            WHERE id = ? AND citizen_id = ?
        `).get(complaintId, citizenId);

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        const report = db.prepare(`
            SELECT
                r.id AS report_id,
                r.complaint_id,
                r.action_description,
                r.evidence_photo,
                r.verification_status,
                r.officer_feedback,
                r.submitted_at,
                r.reviewed_at,
                f.feedback AS citizen_feedback,
                f.rating AS citizen_rating,
                f.created_at AS feedback_submitted_at
            FROM resolution_reports r
            LEFT JOIN citizen_feedback f
                ON f.report_id = r.id
            WHERE r.complaint_id = ?
        `).get(complaintId);

        return res.status(200).json({
            success: true,
            complaintStatus: complaint.status,
            report: report || null
        });

    } catch (error) {
        console.error(
            "Get citizen resolution report error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve the rescue report."
        });
    }
};


// ============================================
// SUBMIT CITIZEN FEEDBACK
// ============================================

const submitCitizenFeedback = (req, res) => {
    try {
        const citizenId = req.citizen.id;
        const complaintId = Number(req.params.complaintId);

        const feedback =
            typeof req.body.feedback === "string"
                ? req.body.feedback.trim()
                : "";

        const rating =
            req.body.rating === undefined ||
            req.body.rating === null ||
            req.body.rating === ""
                ? null
                : Number(req.body.rating);

        if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        if (feedback.length < 5 || feedback.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Feedback must contain 5 to 1000 characters."
            });
        }

        if (
            rating !== null &&
            (!Number.isInteger(rating) || rating < 1 || rating > 5)
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
            });
        }

        const complaint = db.prepare(`
            SELECT
                c.id,
                c.status,
                c.citizen_id,
                a.staff_id,
                a.assigned_by
            FROM complaints c
            INNER JOIN assignments a
                ON a.complaint_id = c.id
            WHERE c.id = ?
              AND c.citizen_id = ?
        `).get(complaintId, citizenId);

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        const report = db.prepare(`
            SELECT id, verification_status
            FROM resolution_reports
            WHERE complaint_id = ?
        `).get(complaintId);

        if (!report) {
            return res.status(409).json({
                success: false,
                message: "The rescue staff has not submitted a report yet."
            });
        }

        if (report.verification_status !== "Awaiting Citizen Feedback") {
            return res.status(409).json({
                success: false,
                message: "This report is not currently awaiting citizen feedback."
            });
        }

        // Save feedback and update statuses
        const submitFeedbackTransaction = db.transaction(() => {
            db.prepare(`
                INSERT INTO citizen_feedback (
                    complaint_id,
                    citizen_id,
                    report_id,
                    feedback,
                    rating
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                complaintId,
                citizenId,
                report.id,
                feedback,
                rating
            );

            db.prepare(`
                UPDATE resolution_reports
                SET verification_status = 'Pending Officer Approval'
                WHERE id = ?
            `).run(report.id);

            db.prepare(`
                UPDATE complaints
                SET status = 'Pending Officer Approval'
                WHERE id = ?
            `).run(complaintId);
        });

        submitFeedbackTransaction();

        // Notify municipal officer
        try {
            createNotification(
                complaint.assigned_by,
                "officer",
                "Citizen Feedback Received!",
                `The citizen has submitted feedback for complaint #${complaintId}. Please review the rescue report and feedback.`,
                "citizen_feedback_submitted",
                complaintId
            );
        } catch (notificationError) {
            console.error(
                "Officer notification error:",
                notificationError.message
            );
        }

        // Notify assigned rescue staff
        try {
            createNotification(
                complaint.staff_id,
                "staff",
                "Citizen Feedback Received!",
                `The citizen has submitted feedback for your rescue report for complaint #${complaintId}. It is now awaiting officer approval.`,
                "citizen_feedback_submitted",
                complaintId
            );
        } catch (notificationError) {
            console.error(
                "Staff notification error:",
                notificationError.message
            );
        }

        return res.status(201).json({
            success: true,
            message: "Your feedback has been submitted successfully. The report is now awaiting municipal officer approval.",
            status: "Pending Officer Approval"
        });

    } catch (error) {
        console.error("Submit citizen feedback error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to submit your feedback."
        });
    }
};


// ============================================
// EXPORT CONTROLLER FUNCTIONS
// ============================================

module.exports = {
    createComplaint,
    getMyComplaints,
    getAllComplaints,
    getAssignableComplaints,
    assignComplaint,
    getCitizenResolutionReport,
    submitCitizenFeedback
};
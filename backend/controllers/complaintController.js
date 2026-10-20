// ============================================
// STRAYSYNC - COMPLAINT CONTROLLER
// ============================================

const db = require("../config/database");

// ============================================
// CREATE ANIMAL COMPLAINT
// ============================================

const createComplaint = (req, res) => {
    try {
        // Get the citizen ID from the verified JWT middleware.
        // Never trust a citizen ID sent by the frontend.
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

        // ----------------------------------------
        // 1. VALIDATE REQUIRED FIELDS
        // ----------------------------------------

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

        // ----------------------------------------
        // 2. VERIFY CITIZEN ACCOUNT
        // ----------------------------------------

        const citizen = db.prepare(`
            SELECT id, phone_verified
            FROM citizens
            WHERE id = ?
        `).get(citizenId);

        if (!citizen || citizen.phone_verified !== 1) {
            return res.status(403).json({
                success: false,
                message: "A verified citizen account is required to submit a report."
            });
        }

        // ----------------------------------------
        // 3. VALIDATE PHOTO
        // ----------------------------------------

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an animal photograph."
            });
        }

        // ----------------------------------------
        // 4. VALIDATE ANIMAL TYPE
        // ----------------------------------------

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

        // ----------------------------------------
        // 5. VALIDATE CATEGORY
        // ----------------------------------------

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

        // ----------------------------------------
        // 6. VALIDATE DESCRIPTION AND LOCATION
        // ----------------------------------------

        const cleanDescription = description.trim();
        const cleanLocation = location.trim();

        if (cleanDescription.length < 10) {
            return res.status(400).json({
                success: false,
                message: "Description must contain at least 10 characters."
            });
        }

        if (cleanDescription.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Description cannot exceed 2000 characters."
            });
        }

        if (cleanLocation.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Location cannot exceed 500 characters."
            });
        }

        // ----------------------------------------
        // 7. VALIDATE GPS COORDINATES
        // ----------------------------------------

        const parseCoordinate = (value, min, max, name) => {
            if (value === undefined || value === null || value === "") {
                return null;
            }

            const number = Number(value);

            if (!Number.isFinite(number) || number < min || number > max) {
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

        // Both coordinates should be supplied together.
        if (
            (parsedLatitude === null) !==
            (parsedLongitude === null)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide both GPS coordinates or leave both empty."
            });
        }

        // ----------------------------------------
        // 8. VALIDATE PRIORITY
        // ----------------------------------------

        const validPriorities = [
            "Low",
            "Medium",
            "High",
            "Critical"
        ];

        const selectedPriority = validPriorities.includes(priority)
            ? priority
            : "Medium";

        // ----------------------------------------
        // 9. SAVE COMPLAINT TO DATABASE
        // ----------------------------------------

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
            `/uploads/${req.file.filename}`,
            selectedPriority,
            "Pending Review"
        );

        // ----------------------------------------
        // 10. RETURN SUCCESS RESPONSE
        // ----------------------------------------

        return res.status(201).json({
            success: true,
            message: "Animal complaint submitted successfully.",
            complaintId: Number(result.lastInsertRowid),
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
// GET COMPLAINTS FOR THE LOGGED-IN CITIZEN
// ============================================

const getMyComplaints = (req, res) => {
    try {
        // Get the citizen ID from the verified authentication token.
        const citizenId = req.citizen.id;

        // Retrieve only this citizen's complaints.
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
// GET /api/complaints/assignable
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
        console.error(
            "Get assignable complaints error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve complaints available for assignment."
        });
    }
};


// ============================================
// ASSIGN COMPLAINT TO RESCUE STAFF
// POST /api/complaints/:complaintId/assign
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
                String(complaint.status).trim().toLowerCase()
                !== "pending review"
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
            `).run(
                complaintId,
                staffId,
                officerId
            );

            db.prepare(`
                UPDATE complaints
                SET status = 'Assigned'
                WHERE id = ?
            `).run(complaintId);

            return { success: true };
        });

        const result = assignTransaction();

        if (result.error) {
            return res.status(result.error).json({
                success: false,
                message: result.message
            });
        }

        return res.status(201).json({
            success: true,
            message: "Complaint assigned to rescue staff successfully."
        });

    } catch (error) {
        console.error(
            "Assign complaint error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to assign this complaint."
        });
    }
};

// ============================================
// EXPORT CONTROLLER
// ============================================

module.exports = {
    createComplaint,
    getMyComplaints,
    getAllComplaints,
    getAssignableComplaints,
    assignComplaint
};
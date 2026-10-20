// ============================================
// STRAYSYNC - MAIN SERVER
// ============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// FILE PATHS
// ============================================

const frontendPath = path.join(__dirname, "../frontend");
const uploadsPath = path.join(__dirname, "uploads");

// ============================================
// SERVE FRONTEND FILES
// ============================================

app.use(express.static(frontendPath));

// Serve uploaded animal photographs
app.use("/uploads", express.static(uploadsPath));

// ============================================
// HOMEPAGE
// ============================================

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// ============================================
// IMPORT ROUTES
// ============================================

const authRoutes = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const adminRoutes = require("./routes/adminRoutes");
const verificationRoutes = require("./routes/verificationRoutes");

// NEW: Staff routes
const staffRoutes = require("./routes/staffRoutes");

// ============================================
// REGISTER ROUTES
// ============================================

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verification", verificationRoutes);


// NEW: Register staff API routes
app.use("/api/staff", staffRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "StraySync backend is running successfully!"
    });
});

// ============================================
// UNKNOWN API ROUTES
// ============================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ============================================
// UNKNOWN PAGE ROUTES
// ============================================

app.use((req, res) => {
    res.status(404).send("Page not found. Please check the URL.");
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`StraySync server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Frontend directory: ${frontendPath}`);
});
// ============================================
// STRAYSYNC - MAIN SERVER
// ============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
require("dotenv").config();
require("./config/initDatabase");

const { initializeSocket } = require("./config/socket");

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Make Socket.IO accessible to Express
app.set("io", io);

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
const staffRoutes = require("./routes/staffRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// ============================================
// REGISTER ROUTES
// ============================================

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/notifications", notificationRoutes);

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

server.listen(PORT, () => {
    console.log(`StraySync server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log("Socket.IO server initialized successfully!");
    console.log(`Frontend directory: ${frontendPath}`);
});
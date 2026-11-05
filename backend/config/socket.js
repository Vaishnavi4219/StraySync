// ========================================
// STRAYSYNC - SOCKET.IO CONFIGURATION
// ========================================

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Verify user before allowing connection
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error("Authentication token required."));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET,
                { issuer: "straysync" }
            );

            let userId;

            if (decoded.role === "citizen") {
                userId = decoded.citizenId;
            } else if (decoded.role === "officer") {
                userId = decoded.officerId;
            } else if (decoded.role === "staff") {
                userId = decoded.staffId;
            } else {
                return next(new Error("Invalid user role."));
            }

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return next(new Error("Invalid user ID."));
            }

            socket.user = {
                id: userId,
                role: decoded.role
            };

            next();

        } catch (error) {
            next(new Error("Invalid or expired authentication token."));
        }
    });

    // Connect authenticated users to their private rooms
    io.on("connection", (socket) => {
        const { id, role } = socket.user;

        const room = `${role}_${id}`;

        socket.join(room);

        console.log(`${role} ${id} connected to notification room.`);

        socket.on("disconnect", () => {
            console.log(`${role} ${id} disconnected.`);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.IO has not been initialized.");
    }

    return io;
}

module.exports = {
    initializeSocket,
    getIO
};
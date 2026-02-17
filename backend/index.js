require("dotenv").config();
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const connectDB = require('./Database/connect');
const { initializeSocket } = require('./middleware/socketHandler');

// Start Server
const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI);

// Create HTTP server with Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Socket.io event handlers
initializeSocket(io);

// Make io accessible to other parts of the app
global.io = io;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})
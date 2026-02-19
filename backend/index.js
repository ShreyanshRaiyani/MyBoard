require("dotenv").config();
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const connectDB = require('./Database/connect');
const { initializeSocket } = require('./middleware/socketHandler');
const { startPlanExpiryCron } = require('./middleware/planExpiryCron');
const { startQueueExpiryCron } = require('./middleware/queueExpiryCron');
const { startRequestExpiryCron } = require('./middleware/requestExpiryCron');

// Start Server
const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI)
    .then(() => {
        startPlanExpiryCron();
        startQueueExpiryCron();
        startRequestExpiryCron();
    })
    .catch((error) => {
        console.error('DB connection failed:', error);
    });

// Create HTTP server with Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

initializeSocket(io);


global.io = io;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})
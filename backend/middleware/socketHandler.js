const jwt = require('jsonwebtoken');

// Store active user connections
const userConnections = new Map();

/**
 * Authenticate socket connections using JWT token
 */
const authenticateSocket = (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return next(new Error('Authentication failed: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
    } catch (error) {
        console.error('Socket authentication error:', error.message);
        next(new Error('Authentication failed: Invalid token'));
    }
};

/**
 * Initialize Socket.io event handlers
 */
const initializeSocket = (io) => {
    // Middleware for authentication
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`User ${userId} connected with socket ID: ${socket.id}`);

        // Join user to their personal room
        socket.join(`user_${userId}`);

        // Store connection info
        userConnections.set(userId, {
            socketId: socket.id,
            connectedAt: new Date(),
            userRole: socket.userRole
        });

        /**
         * Event: User comes online
         */
        socket.on('user_online', (data) => {
            console.log(`User ${userId} is online`);
            io.emit('user_status_changed', {
                userId,
                status: 'online',
                timestamp: new Date()
            });
        });

        /**
         * Event: Typing notification (for future chat feature)
         */
        socket.on('typing', (data) => {
            socket.broadcast.emit('user_typing', {
                userId,
                targetUserId: data.targetUserId,
                isTyping: true
            });
        });

        socket.on('stop_typing', (data) => {
            socket.broadcast.emit('user_typing', {
                userId,
                targetUserId: data.targetUserId,
                isTyping: false
            });
        });

        /**
         * Event: Disconnect handling
         */
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from socket ID: ${socket.id}`);
            
            userConnections.delete(userId);
            
            io.emit('user_status_changed', {
                userId,
                status: 'offline',
                timestamp: new Date()
            });
        });

        /**
         * Event: Error handling
         */
        socket.on('error', (error) => {
            console.error(`Socket error for user ${userId}:`, error);
        });
    });
};

/**
 * Emit notification to a specific user
 */
const notifyUser = (userId, eventName, data) => {
    if (global.io) {
        global.io.to(`user_${userId}`).emit(eventName, data);
        console.log(`Notification sent to user ${userId}`);
    }
};

/**
 * Emit notification to multiple users
 */
const notifyMultipleUsers = (userIds, eventName, data) => {
    if (global.io) {
        userIds.forEach(userId => {
            global.io.to(`user_${userId}`).emit(eventName, data);
        });
        console.log(`Notification sent to ${userIds.length} users`);
    }
};

/**
 * Broadcast notification to all connected users
 */
const broadcastNotification = (eventName, data) => {
    if (global.io) {
        global.io.emit(eventName, data);
        console.log(`Broadcasted notification: ${eventName}`);
    }
};

/**
 * Get user connection status
 */
const getUserConnectionStatus = (userId) => {
    return userConnections.get(userId) || null;
};

/**
 * Get all active connections
 */
const getAllActiveConnections = () => {
    return Array.from(userConnections.entries()).map(([userId, data]) => ({
        userId,
        ...data
    }));
};

module.exports = {
    initializeSocket,
    notifyUser,
    notifyMultipleUsers,
    broadcastNotification,
    getUserConnectionStatus,
    getAllActiveConnections,
    userConnections
};

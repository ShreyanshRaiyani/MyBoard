/**
 * CLIENT-SIDE Socket.io Configuration
 * 
 * This file should be used in your frontend application (React/Vue/etc.)
 * to establish a real-time connection with the backend.
 * 
 * Installation: npm install socket.io-client
 */

import io from 'socket.io-client';

class NotificationSocket {
    constructor(serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000') {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.listeners = {};
    }

    /**
     * Initialize socket connection
     * @param {string} token - JWT authentication token
     */
    connect(token) {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }

        this.socket = io(this.serverUrl, {
            auth: {
                token: token
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling']
        });

        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.emit('user_online', { status: 'online' });
            this.triggerListener('onConnect');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.triggerListener('onDisconnect');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.triggerListener('onError', error);
        });

        // Notification events
        this.socket.on('new_notification', (data) => {
            console.log('New notification received:', data);
            this.triggerListener('onNewNotification', data);
        });

        // User status events
        this.socket.on('user_status_changed', (data) => {
            console.log('User status changed:', data);
            this.triggerListener('onUserStatusChanged', data);
        });

        // Typing indicator events
        this.socket.on('user_typing', (data) => {
            console.log('User typing:', data);
            this.triggerListener('onUserTyping', data);
        });
    }

    /**
     * Disconnect socket
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    /**
     * Emit custom event to server
     */
    emit(eventName, data) {
        if (this.socket?.connected) {
            this.socket.emit(eventName, data);
        } else {
            console.warn('Socket not connected');
        }
    }

    /**
     * Subscribe to custom event
     */
    on(eventName, callback) {
        if (this.socket) {
            this.socket.on(eventName, callback);
        }
    }

    /**
     * Register listener callbacks
     */
    listen(eventType, callback) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    }

    /**
     * Trigger all listeners for an event
     */
    triggerListener(eventType, data = null) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in listener ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.socket?.connected || false;
    }

    /**
     * Get socket ID
     */
    getSocketId() {
        return this.socket?.id || null;
    }
}

// Create singleton instance
const notificationSocket = new NotificationSocket();

export default notificationSocket;

/**
 * USAGE EXAMPLE IN REACT:
 * 
 * import notificationSocket from './notificationSocket';
 * import { useEffect } from 'react';
 * 
 * function useNotifications() {
 *     useEffect(() => {
 *         // Connect socket when component mounts
 *         const token = localStorage.getItem('authToken');
 *         if (token) {
 *             notificationSocket.connect(token);
 *         }
 * 
 *         // Listen for new notifications
 *         notificationSocket.listen('onNewNotification', (notification) => {
 *             console.log('Received notification:', notification);
 *             // Update notifications state, show toast, etc.
 *         });
 * 
 *         // Listen for connection events
 *         notificationSocket.listen('onConnect', () => {
 *             console.log('Connected to server');
 *         });
 * 
 *         notificationSocket.listen('onDisconnect', () => {
 *             console.log('Disconnected from server');
 *         });
 * 
 *         return () => {
 *             // Don't disconnect on unmount to keep connection alive
 *         };
 *     }, []);
 * 
 *     return notificationSocket;
 * }
 * 
 * // In your component:
 * function NotificationCenter() {
 *     const socket = useNotifications();
 * 
 *     return (
 *         <div>
 *             <p>Connected: {socket.isConnected() ? 'Yes' : 'No'}</p>
 *         </div>
 *     );
 * }
 */

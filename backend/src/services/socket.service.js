const { Server } = require('socket.io');
const User = require('../models/user.model');
const { verifyToken } = require('../utils/jwt');

let ioInstance = null;

const parseTokenFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';').map((entry) => entry.trim());
  for (const part of parts) {
    if (part.startsWith('token=')) {
      return decodeURIComponent(part.slice('token='.length));
    }
  }

  return null;
};

const extractSocketToken = (socket) => {
  if (socket.handshake?.auth?.token) {
    return socket.handshake.auth.token;
  }

  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const cookieToken = parseTokenFromCookieHeader(socket.handshake?.headers?.cookie);
  if (cookieToken) {
    return cookieToken;
  }

  return null;
};

const attachSocketAuthMiddleware = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next(new Error('Socket authentication failed: missing token'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (!user || !user.isActive) {
        return next(new Error('Socket authentication failed: inactive user'));
      }

      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('Socket authentication failed: invalid token'));
    }
  });
};

const initSocketServer = (httpServer, corsOrigins) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  attachSocketAuthMiddleware(ioInstance);

  ioInstance.on('connection', (socket) => {
    const userId = String(socket.user._id);
    const userRole = socket.user.role;

    socket.join(`user:${userId}`);
    socket.join(`role:${userRole}`);

    socket.emit('socket:ready', {
      message: 'Connected to real-time channel',
      userId,
      role: userRole,
      connectedAt: new Date().toISOString(),
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${String(userId)}`).emit(eventName, payload);
};

const emitToRole = (role, eventName, payload) => {
  if (!ioInstance || !role) return;
  ioInstance.to(`role:${role}`).emit(eventName, payload);
};

module.exports = {
  initSocketServer,
  getIO,
  emitToUser,
  emitToRole,
};

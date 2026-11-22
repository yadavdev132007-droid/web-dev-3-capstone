const { Server } = require('socket.io');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

let io = null;

// Clients connect with:  io(URL, { auth: { token: '<access token>' } })
// Each user joins a private room "user:<id>"; admins also join "admins".
function initSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.id);
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = { id: user._id.toString(), role: user.role };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
    socket.emit('connected', { userId: socket.user.id, role: socket.user.role });
  });

  return io;
}

const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId.toString()}`).emit(event, payload);
};
const emitToAdmins = (event, payload) => {
  if (io) io.to('admins').emit(event, payload);
};

module.exports = { initSockets, emitToUser, emitToAdmins };

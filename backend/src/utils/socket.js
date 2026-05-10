const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join:session', (sessionId) => {
      socket.join(sessionId);
      console.log(`👥 Socket ${socket.id} joined session: ${sessionId}`);
    });

    socket.on('leave:session', (sessionId) => {
      socket.leave(sessionId);
      console.log(`🏃 Socket ${socket.id} left session: ${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

function emitToSession(sessionId, event, data) {
  if (!io) return;
  io.to(sessionId).emit(event, data);
}

module.exports = { initSocket, getIO, emitToSession };

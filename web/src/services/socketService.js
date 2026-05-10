import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const socket = io(URL, {
  autoConnect: true,
  withCredentials: true,
});

const socketService = {
  joinSession: (sessionId) => {
    socket.emit('join:session', sessionId);
  },

  leaveSession: (sessionId) => {
    socket.emit('leave:session', sessionId);
  },

  onAttendanceMarked: (callback) => {
    socket.on('attendance:marked', callback);
    return () => socket.off('attendance:marked', callback);
  },

  onQRRefreshed: (callback) => {
    socket.on('qr:refreshed', callback);
    return () => socket.off('qr:refreshed', callback);
  },

  onCodeRefreshed: (callback) => {
    socket.on('code:refreshed', callback);
    return () => socket.off('code:refreshed', callback);
  },

  disconnect: () => {
    socket.disconnect();
  },
};

export default socketService;

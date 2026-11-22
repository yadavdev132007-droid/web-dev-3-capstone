require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initSockets } = require('./src/sockets');
const { registerNotificationListeners } = require('./src/services/notificationService');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    initSockets(server);
    registerNotificationListeners();

    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

    const shutdown = async (sig) => {
      console.log(`${sig} received, shutting down...`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

// Quick listener to watch real-time notifications.
// Usage: node scripts/socketClient.js <ACCESS_TOKEN>
// (requires: npm i socket.io-client --no-save)
const { io } = require('socket.io-client');

const token = process.argv[2];
if (!token) { console.error('Usage: node scripts/socketClient.js <ACCESS_TOKEN>'); process.exit(1); }

const socket = io(process.env.SOCKET_URL || 'http://localhost:5000', { auth: { token } });
socket.on('connected', (d) => console.log('connected as', d));
socket.on('order:new', (d) => console.log('[order:new]', d));
socket.on('order:status', (d) => console.log('[order:status]', d));
socket.on('stock:low', (d) => console.log('[stock:low]', d));
socket.on('connect_error', (e) => console.error('connect_error:', e.message));

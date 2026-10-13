import { createBackend } from './server.js';
import { createServices } from './services.js';
import { createPlazas } from './plazas.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const lobby = createPlazas({ services: createServices(), limit: Number(process.env.LOBBY_PLAYER_LIMIT || 10), websocketUrl: process.env.REALTIME_WEBSOCKET_URL });
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',');
for (const origin of [...origins]) {
  const url = new URL(origin);
  if (['localhost','127.0.0.1'].includes(url.hostname)) { url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost'; origins.push(url.origin); }
}
const server = createBackend({ lobby, origins });
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`PixelPlaza backend ready on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  setTimeout(() => process.exit(1), 5000).unref();
  await lobby.close();
  server.close(() => process.exit(0));
});

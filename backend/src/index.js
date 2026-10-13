import { createBackend } from './server.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createBackend();
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`PixelPlaza backend ready on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
});

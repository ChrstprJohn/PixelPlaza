import { createServer } from 'node:http';
import { ApiError } from './lobby.js';

export function createBackend({ lobby, origins = ['http://localhost:5173', 'http://127.0.0.1:5173'] } = {}) {
  const allowed = new Set(origins);
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => { response.statusCode = status; response.end(JSON.stringify(value)); };
    const origin = request.headers.origin;
    if (origin && !allowed.has(origin)) return send(403, { error: 'This website is not allowed.' });
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return send(204, {});
    }
    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ status: 'ok', service: 'pixelplaza-backend', stage: lobby ? 'playable-lobby' : 'initial-setup' }));
      return;
    }
    if (!lobby) return send(404, { error: 'Not found' });
    const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization || '')?.[1];
    try {
      if (request.method === 'GET' && request.url === '/api/lobbies') return send(200, { lobbies: lobby.list() });
      if (request.method === 'GET' && request.url === '/api/lobby') return send(200, await lobby.read(token));
      const routes = ['/api/join', '/api/move', '/api/chat', '/api/heartbeat', '/api/token', '/api/leave'];
      if (request.method !== 'POST' || !routes.includes(request.url)) return send(404, { error: 'Not found' });
      if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new ApiError(415, 'Send JSON data.');
      const raw = await new Promise((resolve, reject) => {
        const chunks = []; let bytes = 0, tooLarge = false;
        request.on('data', chunk => {
          if (tooLarge) return;
          bytes += chunk.length;
          if (bytes > 4096) { tooLarge = true; reject(new ApiError(413, 'Request is too large.')); return; }
          chunks.push(chunk);
        });
        request.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks).toString('utf8')); });
        request.on('error', reject);
        request.on('aborted', () => reject(new ApiError(400, 'Request was interrupted.')));
      });
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { throw new ApiError(400, 'Invalid JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Invalid request.');
      let result;
      if (request.url === '/api/join') result = await lobby.join(body, request.socket.remoteAddress || 'unknown');
      else if (request.url === '/api/move') result = await lobby.move(token, body);
      else if (request.url === '/api/chat') result = await lobby.chat(token, body);
      else if (request.url === '/api/heartbeat') result = await lobby.heartbeat(token);
      else if (request.url === '/api/token') result = await lobby.token(token);
      else result = await lobby.leave(token);
      send(200, result);
    } catch (error) { send(error instanceof ApiError ? error.status : 503, { error: error instanceof ApiError ? error.message : 'The service is unavailable. Please try again.' }); }
  });
}

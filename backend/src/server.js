import { createServer } from 'node:http';

export function createBackend() {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ status: 'ok', service: 'pixelplaza-backend', stage: 'initial-setup' }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}

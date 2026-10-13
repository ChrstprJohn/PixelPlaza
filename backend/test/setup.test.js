import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from '../src/server.js';
import { createServices } from '../src/services.js';

test('backend exposes only a non-secret health endpoint', async () => {
  const server = createBackend();
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(url + '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'pixelplaza-backend', stage: 'initial-setup' });
    assert.equal((await fetch(url + '/join', { method: 'POST' })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('service helpers reject wrong projects and upstream errors', async () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'redis-key', REALTIME_API_URL: 'https://realtime.example.com/backend', REALTIME_API_KEY: 'realtime-key', REALTIME_PROJECT_ID: 'pixelplaza' };
  assert.throws(() => createServices({ ...env, REALTIME_PROJECT_ID: 'starter' }));
  assert.throws(() => createServices({ ...env, UPSTASH_REDIS_REST_URL: 'http://redis.example.com' }));
  const calls = [];
  const services = createServices(env, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => url.endsWith('/token') ? { token: 'jwt', expiresIn: 900 } : url.endsWith('/publish') ? { success: true } : { result: 'PONG' } };
  });
  assert.equal(await services.redis(['PING']), 'PONG');
  assert.equal((await services.token('user', ['pixelplaza/lobby/main'])).token, 'jwt');
  assert.equal((await services.publish('pixelplaza/lobby/main', {})).success, true);
  await assert.rejects(services.publish('other/lobby/main', {}));
  await assert.rejects(services.token('user', ['other/lobby/main']));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer redis-key');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer realtime-key');
  const broken = createServices(env, async () => ({ ok: true, json: async () => ({ error: 'denied' }) }));
  await assert.rejects(broken.redis(['PING']));
});

test('HTTP routes reject untrusted origins, missing sessions, malformed JSON and oversized bodies', async () => {
  const lobby = { read: async token => { if (!token) { const { ApiError } = await import('../src/lobby.js'); throw new ApiError(401, 'Join first'); } return {}; }, join: async () => ({ ok: true }) };
  const server = createBackend({ lobby });
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url + '/api/lobby')).status, 401);
    assert.equal((await fetch(url + '/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const post = body => fetch(url + '/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal((await post('{bad')).status, 400);
    assert.equal((await post(JSON.stringify({ name: 'x'.repeat(5000) }))).status, 413);
    assert.equal((await post(JSON.stringify({ name: '日本のゲスト', character: 'cat' }))).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

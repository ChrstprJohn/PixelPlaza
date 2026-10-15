import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createBackend } from '../src/server.js';
import { createPlazas } from '../src/plazas.js';

test('admin protects management, signs and expires sessions, persists closures, and removes players', async t => {
  const records = new Map();
  const services = {
    async redis([command, key, value]) {
      if (command === 'GET') return records.get(key) ?? null;
      if (command === 'SET') { records.set(key, value); return 'OK'; }
      if (command === 'DEL') { records.delete(key); return 1; }
      if (command === 'LRANGE') return [];
      if (command === 'EVAL' || command === 'EXPIRE') return 1;
      throw new Error('Unsupported command');
    },
    publish: async () => {}, token: async () => ({ token: 'test' }),
  };
  let time = Date.now();
  const lobby = createPlazas({ services, autoStart: false });
  const env = { ADMIN_PASSWORD: 'test-password-with-24-characters', NODE_ENV: 'production' };
  const server = createBackend({ lobby, adminEnv: env, now: () => time });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await lobby.close(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = (path, body, origin = 'http://localhost:5173') => fetch(`${base}/api/admin/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { cookie } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await call('lobbies')).status, 401);
  assert.equal((await call('login', { password: env.ADMIN_PASSWORD }, 'https://evil.example')).status, 403);
  assert.equal((await call('login', { password: env.ADMIN_PASSWORD }, '')).status, 403);
  assert.equal((await call('login', { password: 'wrong' })).status, 401);
  const login = await call('login', { password: env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly; SameSite=Strict/); assert.match(setCookie, /Secure/);
  cookie = setCookie.split(';')[0];
  assert.equal((await (await call('session')).json()).authenticated, true);
  const list = await (await call('lobbies')).json();
  assert.equal(list.lobbies.length, 2);
  assert.equal((await call('lobbies', { lobbyId: 'garden', action: 'close' })).status, 200);
  await assert.rejects(lobby.join({ lobbyId: 'garden', name: 'Guest', character: 'cat' }, 'test'), /closed/);
  const restarted = createPlazas({ services, autoStart: false });
  await restarted.ready(); assert.equal(restarted.list()[0].closed, true); await restarted.close();
  assert.equal((await call('lobbies', { lobbyId: 'garden', action: 'open' })).status, 200);
  const guest = await lobby.join({ lobbyId: 'garden', name: 'Guest', character: 'cat' }, 'test');
  assert.equal((await call('lobbies', { lobbyId: 'garden', action: 'remove', playerId: guest.playerId })).status, 200);
  await assert.rejects(async () => lobby.read(guest.sessionToken), /session ended/);
  assert.equal((await call('lobbies', { lobbyId: 'garden', action: 'delete' })).status, 400);
  const validCookie = cookie;
  cookie += 'forged'; assert.equal((await call('lobbies')).status, 401);
  cookie = validCookie; time += 8 * 60 * 60 * 1000 + 1000;
  assert.equal((await call('lobbies')).status, 401);
  time = Date.now();
  assert.equal((await call('logout', {})).headers.get('set-cookie').includes('Max-Age=0'), true);
  cookie = ''; env.ADMIN_PASSWORD = '';
  assert.equal((await call('login', { password: 'anything' })).status, 503);
});

test('admin throttles password guesses', async t => {
  const server = createBackend({ lobby: {}, adminEnv: { ADMIN_PASSWORD: 'test-password-at-least16' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/login`;
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await fetch(url, { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) });
    assert.equal(response.status, attempt < 10 ? 401 : 429);
  }
});

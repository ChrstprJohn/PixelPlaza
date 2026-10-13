import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServices } from '../backend/src/services.js';

const origin = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',')[0];
const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
const guests = [], sockets = [];
async function call(path, body, token) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json() };
}
const until = async predicate => {
  const end = Date.now() + 10000;
  while (!predicate()) { if (Date.now() > end) throw new Error('Live lobby event timed out'); await new Promise(resolve => setTimeout(resolve, 40)); }
};
try {
  for (const character of ['cat', 'robot']) {
    const result = await call('/api/join', { name: `Test ${character}`, character });
    assert.equal(result.status, 200); guests.push(result.data);
  }
  const [alice, bob] = guests;
  assert.equal((await call('/api/lobby', undefined, 'f'.repeat(64))).status, 401);
  const events = [], ws = new WebSocket(bob.websocketUrl); sockets.push(ws);
  ws.addEventListener('message', event => { for (const line of String(event.data).split('\n').filter(Boolean)) { const data = JSON.parse(line); events.push(data); if (!Object.keys(data).length) ws.send('{}'); } });
  await until(() => ws.readyState === WebSocket.OPEN);
  ws.send(JSON.stringify({ id: 1, connect: { token: bob.token } }));
  await until(() => events.some(e => e.connect));
  const text = 'Temporary chat verified ' + randomBytes(3).toString('hex');
  const chat = await call('/api/chat', { text }, alice.sessionToken);
  assert.equal(chat.status, 200);
  await until(() => events.some(e => e.push?.pub?.data?.message?.id === chat.data.message.id));
  const read = await call('/api/lobby', undefined, bob.sessionToken);
  assert.ok(read.data.messages.some(message => message.id === chat.data.message.id));
  const redis = createServices();
  const chatKey = `pixelplaza:lobby:${alice.instance}:chat`;
  const ttl = await redis.redis(['TTL', chatKey]);
  assert.ok(ttl > 850 && ttl <= 900);
  const before = read.data.players.find(player => player.id === alice.playerId);
  assert.equal((await call('/api/move', { dx: 1, dy: 0, sequence: 1 }, alice.sessionToken)).status, 200);
  await new Promise(resolve => setTimeout(resolve, 180));
  const after = (await call('/api/lobby', undefined, bob.sessionToken)).data.players.find(player => player.id === alice.playerId);
  assert.ok(after.x > before.x && after.x - before.x <= 35);
  let count = read.data.players.length;
  while (count < 10) { const result = await call('/api/join', { name: `Capacity ${count}`, character: 'sprout' }); assert.equal(result.status, 200); guests.push(result.data); count++; }
  assert.equal((await call('/api/join', { name: 'Eleventh', character: 'mushroom' })).status, 409);
  console.log('PASS: real VM Redis chat storage/expiry, realtime chat between guests, authenticated movement, forged-session rejection, and 10-player capacity.');
} finally {
  for (const socket of sockets) socket.close();
  await Promise.all(guests.map(guest => call('/api/leave', {}, guest.sessionToken).catch(() => {})));
  // Synthetic messages are left only in the temporary chat list and expire with its TTL.
}

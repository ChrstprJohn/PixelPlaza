import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLobby } from '../src/lobby.js';
import { walkable, WORLD } from '../../shared/world.js';

function fixture() {
  let time = 1000000;
  const records = new Map(), events = [];
  let unavailable = false;
  const alive = key => { const record = records.get(key); if (record?.expires <= time) { records.delete(key); return; } return record; };
  const redis = async args => {
    if (unavailable) throw new Error('Offline');
    const [command, key, ...rest] = args;
    if (command === 'SET') { records.set(key, { value: rest[0], expires: time + Number(rest[2]) * 1000 }); return 'OK'; }
    if (command === 'GET') return alive(key)?.value ?? null;
    if (command === 'DEL') { records.delete(key); return 1; }
    if (command === 'EXPIRE') { const record = alive(key); if (!record) return 0; record.expires = time + Number(rest[0]) * 1000; return 1; }
    if (command === 'LRANGE') return [...(alive(key)?.value || [])];
    if (command === 'EVAL') {
      const script = key, actual = args[3], value = args[4];
      if (script.includes('LPUSH')) { const list = [value, ...(alive(actual)?.value || [])].slice(0, 60); records.set(actual, { value: list, expires: time + 900000 }); return 1; }
      const record = alive(actual) || { value: 0, expires: time + Number(value) * 1000 };
      record.value++; records.set(actual, record); return record.value;
    }
    throw new Error('Unsupported test command');
  };
  const services = { redis, token: async () => ({ token: 'signed-test-token' }), publish: async (channel, event) => events.push({ channel, event }) };
  const lobby = createLobby({ services, now: () => time, websocketUrl: 'wss://example.com', autoStart: false });
  return { lobby, records, events, addTime: delta => { time += delta; }, failStorage: value => { unavailable = value; } };
}

test('ten concurrent guests fit, eleventh rejected, invalid/forged sessions rejected, leave releases slot', async () => {
  const f = fixture();
  const guests = await Promise.all(Array.from({ length: 10 }, (_, i) => f.lobby.join({ name: `Guest ${i}`, character: 'cat' }, 'local')));
  assert.equal(f.lobby.state().players.length, 10);
  assert.ok(f.lobby.state().players.every(p => walkable(p.x, p.y)));
  await assert.rejects(f.lobby.join({ name: 'Overflow', character: 'cat' }, 'local'), error => error.status === 409);
  await assert.rejects(f.lobby.read('f'.repeat(64)), error => error.status === 401);
  await assert.rejects(f.lobby.join({ name: '<script>', character: 'cat' }, 'local'), error => error.status === 400);
  await assert.rejects(f.lobby.join({ name: 'Valid', character: 'dragon' }, 'local'), error => error.status === 400);
  await f.lobby.leave(guests[0].sessionToken);
  await f.lobby.join({ name: 'Replacement', character: 'robot' }, 'local');
  assert.equal(f.lobby.state().players.length, 10);
  const serialized = JSON.stringify(f.lobby.state());
  assert.ok(!serialized.includes(guests[1].sessionToken));
  assert.ok(!serialized.includes('session:'));
  await f.lobby.close();
});

test('server controls speed, normalizes diagonal movement, refuses forged movement and replays', async () => {
  const f = fixture(), guest = await f.lobby.join({ name: 'Walker', character: 'sprout' }, 'local');
  const start = f.lobby.state().players[0];
  await assert.rejects(f.lobby.move(guest.sessionToken, { dx: 100, dy: 0, sequence: 1 }), error => error.status === 400);
  await f.lobby.move(guest.sessionToken, { dx: 1, dy: 1, sequence: 1 });
  f.addTime(100); f.lobby.advance();
  const moved = f.lobby.state().players[0];
  assert.ok(Math.hypot(moved.x - start.x, moved.y - start.y) <= WORLD.speed * .1 + 1);
  await f.lobby.move(guest.sessionToken, { dx: -1, dy: -1, sequence: 1 });
  f.addTime(100); f.lobby.advance();
  assert.ok(f.lobby.state().players[0].x >= moved.x);
  await f.lobby.flush();
  assert.equal(f.events[0].event.type, 'lobby.state');
  const snapshot = [...f.records].find(([key]) => key.endsWith(':state'));
  assert.ok(snapshot);
  f.addTime(500); f.lobby.advance();
  const stopped = f.lobby.state().players[0];
  f.addTime(100); f.lobby.advance();
  assert.equal(f.lobby.state().players[0].x, stopped.x);
  await f.lobby.close();
});

test('chat is validated, limited, capped at 60, expires after 15 minutes quiet; heartbeat renews sessions', async () => {
  const f = fixture(), guest = await f.lobby.join({ name: 'Chatter', character: 'mushroom' }, 'local');
  await assert.rejects(f.lobby.chat(guest.sessionToken, { text: 'x'.repeat(201) }), error => error.status === 400);
  for (let i = 0; i < 5; i++) await f.lobby.chat(guest.sessionToken, { text: `Hello ${i}` });
  await assert.rejects(f.lobby.chat(guest.sessionToken, { text: 'Too fast' }), error => error.status === 429);
  for (let i = 5; i < 65; i++) { f.addTime(10001); await f.lobby.heartbeat(guest.sessionToken); await f.lobby.chat(guest.sessionToken, { text: `Hello ${i}` }); }
  const read = await f.lobby.read(guest.sessionToken);
  assert.equal(read.messages.length, 60);
  assert.equal(read.messages[0].text, 'Hello 5');
  const chatRecord = [...f.records].find(([key]) => key.endsWith(':chat'));
  assert.equal(chatRecord[1].expires, 2500060);
  for (let i = 0; i < 31; i++) { f.addTime(30000); await f.lobby.heartbeat(guest.sessionToken); }
  assert.deepEqual((await f.lobby.read(guest.sessionToken)).messages, []);
  await f.lobby.close();
});

test('storage failure fails closed; heartbeat timeout and backend restart require rejoin', async () => {
  const f = fixture();
  f.failStorage(true);
  await assert.rejects(f.lobby.join({ name: 'Offline', character: 'cat' }, 'local'), error => error.status === 503);
  f.failStorage(false);
  const guest = await f.lobby.join({ name: 'Guest', character: 'robot' }, 'local');
  f.failStorage(true);
  await assert.rejects(f.lobby.chat(guest.sessionToken, { text: 'No save' }), error => error.status === 503);
  f.failStorage(false); f.addTime(46000); f.lobby.advance();
  assert.equal(f.lobby.state().players.length, 0);
  await assert.rejects(f.lobby.read(guest.sessionToken), error => error.status === 401);
  const second = fixture();
  await assert.rejects(second.lobby.read(guest.sessionToken), error => error.status === 401);
  await f.lobby.close(); await second.lobby.close();
});

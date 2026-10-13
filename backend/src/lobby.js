import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { WORLD, CHARACTERS, movePosition } from '../../shared/world.js';

const rateScript = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`;
const chatScript = `redis.call('LPUSH',KEYS[1],ARGV[1]); redis.call('LTRIM',KEYS[1],0,59); redis.call('EXPIRE',KEYS[1],900); return 1`;
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function createLobby({ services, limit = 10, now = Date.now, websocketUrl, autoStart = true }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('Player limit must be 1-10');
  const instance = randomBytes(8).toString('hex');
  const channel = `pixelplaza/lobby/${instance}`;
  const prefix = `pixelplaza:lobby:${instance}`;
  const players = new Map();
  let revision = 0, lastTick = now(), dirty = false, busy = false, closed = false, delayed = false;
  let lastSnapshot = 0, budgetMinute = -1, budgetCount = 0;
  const hash = text => createHash('sha256').update(text).digest('hex');
  const redis = async command => { try { return await services.redis(command); } catch { throw new ApiError(503, 'Storage is unavailable. Please try again.'); } };
  const visible = () => [...players.values()].filter(p => p.ready).map(p => ({ id: p.id, name: p.name, character: p.character, x: Math.round(p.x), y: Math.round(p.y), facing: p.facing, moving: now() - p.inputAt < 300 && Boolean(p.dx || p.dy) }));
  const state = () => ({ instance, revision, players: visible(), limit, channel, world: WORLD, realtimeDelayed: delayed });
  const touch = () => { revision++; dirty = true; };
  async function rate(key, seconds, max) {
    const count = await redis(['EVAL', rateScript, '1', `${prefix}:rate:${key}`, String(seconds)]);
    if (!Number.isSafeInteger(count) || count < 1) throw new ApiError(503, 'Invalid storage reply.');
    if (count > max) throw new ApiError(429, 'Please slow down and try again shortly.');
  }
  async function auth(token, verify = false) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'Join the plaza first.');
    const player = players.get(hash(token));
    if (!player?.ready || now() - player.seen > 45000) throw new ApiError(401, 'Your guest session ended. Please rejoin.');
    if (verify || now() - player.verified > 20000) {
      if (await redis(['GET', player.key]) !== player.id) { await remove(player); throw new ApiError(401, 'Your guest session ended. Please rejoin.'); }
      player.verified = now();
    }
    return player;
  }
  async function remove(player) {
    players.delete(player.hash); touch();
    try { await services.redis(['DEL', player.key]); } catch { /* Session key expires without cleanup. */ }
  }
  async function history() {
    const rows = await redis(['LRANGE', `${prefix}:chat`, '0', '59']);
    if (!Array.isArray(rows)) throw new ApiError(503, 'Chat history is unavailable.');
    return rows.map(row => JSON.parse(row)).reverse();
  }
  async function publish(data) {
    const minute = Math.floor(now() / 60000);
    if (minute !== budgetMinute) { budgetMinute = minute; budgetCount = 0; }
    if (++budgetCount > 540) throw new ApiError(429, 'Live updates are busy. Try again shortly.');
    await services.publish(channel, data);
  }
  function advance() {
    const time = now(), dt = Math.min((time - lastTick) / 1000, 0.1);
    lastTick = time;
    for (const player of players.values()) {
      if (player.ready && time - player.seen > 45000) { void remove(player); continue; }
      if (!player.ready || time - player.inputAt > 300 || time - player.verified > 30000) continue;
      const beforeX = player.x, beforeY = player.y;
      movePosition(player, player.dx, player.dy, dt);
      if (beforeX !== player.x || beforeY !== player.y) touch();
    }
  }
  async function flush() {
    if (closed || busy || !dirty || !visible().length) return;
    busy = true;
    const snapshot = state();
    try {
      await publish({ type: 'lobby.state', ...snapshot });
      if (now() - lastSnapshot > 1000) {
        await redis(['SET', `${prefix}:state`, JSON.stringify(snapshot), 'EX', '60']);
        lastSnapshot = now();
      }
      delayed = false;
      if (revision === snapshot.revision) dirty = false;
    } catch { delayed = true; }
    finally { busy = false; }
  }
  const timers = autoStart ? [setInterval(advance, 50), setInterval(() => void flush(), 200)] : [];
  for (const timer of timers) timer.unref();
  return {
    state, advance, flush, channel,
    async join({ name, character }, ip) {
      if (closed) throw new ApiError(503, 'The plaza is restarting.');
      name = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
      if (!/^[\p{L}\p{N} _-]{2,18}$/u.test(name)) throw new ApiError(400, 'Use 2-18 letters or numbers for your name.');
      if (!CHARACTERS.includes(character)) throw new ApiError(400, 'Choose one of the four characters.');
      await rate(`join:${hash(ip)}`, 60, 20);
      if (players.size >= limit) throw new ApiError(409, 'The plaza is full. Please try again when someone leaves.');
      const token = randomBytes(32).toString('hex'), digest = hash(token);
      const slot = players.size;
      const spawnPoints = [[330,265],[420,265],[510,265],[600,265],[690,265],[330,470],[420,540],[510,550],[600,540],[780,520]];
      const occupied = [...players.values()];
      const [x, y] = spawnPoints.find(([sx, sy]) => occupied.every(p => Math.hypot(p.x - sx, p.y - sy) > 55)) || spawnPoints[slot];
      const player = { id: randomUUID(), hash: digest, key: `${prefix}:session:${digest}`, name, character, x, y, facing: 'down', dx: 0, dy: 0, inputAt: 0, sequence: -1, seen: now(), verified: now(), ready: false };
      players.set(digest, player);
      try {
        await redis(['SET', player.key, player.id, 'EX', '1800']);
        const connection = await services.token(player.id, [channel]);
        const messages = await history();
        if (closed) throw new ApiError(503, 'The plaza is restarting.');
        player.ready = true; touch();
        return { sessionToken: token, playerId: player.id, token: connection.token, websocketUrl, ...state(), messages };
      } catch (error) {
        await remove(player);
        throw error instanceof ApiError ? error : new ApiError(503, 'Realtime is unavailable. Please try again.');
      }
    },
    async read(token) { const player = await auth(token); const historyReadAt = now(); return { ...state(), playerId: player.id, messages: await history(), historyReadAt }; },
    async heartbeat(token) {
      const player = await auth(token, true);
      await redis(['EXPIRE', player.key, '1800']);
      player.seen = now();
      return { ok: true, realtimeDelayed: delayed };
    },
    async token(token) { const player = await auth(token, true); return services.token(player.id, [channel]); },
    async move(token, input) {
      const player = await auth(token);
      if (![-1, 0, 1].includes(input.dx) || ![-1, 0, 1].includes(input.dy) || !Number.isSafeInteger(input.sequence) || input.sequence < 0) throw new ApiError(400, 'Invalid movement input.');
      if (input.sequence <= player.sequence) return { ok: true };
      if (now() - player.inputAt < 65) throw new ApiError(429, 'Movement updates are too frequent.');
      player.sequence = input.sequence; player.dx = input.dx; player.dy = input.dy; player.inputAt = now(); player.seen = now();
      if (input.dx) player.facing = input.dx < 0 ? 'left' : 'right';
      else if (input.dy) player.facing = input.dy < 0 ? 'up' : 'down';
      touch(); return { ok: true };
    },
    async chat(token, { text }) {
      const player = await auth(token, true);
      text = typeof text === 'string' ? text.trim() : '';
      if (!text || text.length > 200 || /[\x00-\x08\x0b-\x1f\x7f]/.test(text)) throw new ApiError(400, 'Write a message of 1-200 characters.');
      await rate(`chat:${player.hash}`, 10, 5);
      const message = { id: randomUUID(), playerId: player.id, name: player.name, character: player.character, text, at: now() };
      await redis(['EVAL', chatScript, '1', `${prefix}:chat`, JSON.stringify(message)]);
      player.seen = now();
      try { await publish({ type: 'chat.message', message }); } catch { delayed = true; }
      return { message, realtimeDelayed: delayed };
    },
    async leave(token) { const player = await auth(token); await remove(player); return { ok: true }; },
    async close() {
      closed = true;
      for (const timer of timers) clearInterval(timer);
      await Promise.all([...players.values()].map(remove));
      // Chat intentionally remains temporarily available in Redis until its 15-minute TTL.
      try { await services.redis(['DEL', `${prefix}:state`]); } catch { /* TTL is the cleanup fallback. */ }
    },
  };
}

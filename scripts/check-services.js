import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServices } from '../backend/src/services.js';

const services = createServices();
const id = randomBytes(8).toString('hex');
const key = `pixelplaza:setup:${id}`;
const channel = `pixelplaza/setup/${id}`;
assert.equal(await services.redis(['PING']), 'PONG');
try {
  assert.equal(await services.redis(['SET', key, 'connected', 'EX', '60']), 'OK');
  assert.equal(await services.redis(['GET', key]), 'connected');
  await assert.rejects(services.redis(['GET', 'schedsnap:likes:counts']));
  await assert.rejects(services.redis(['CONFIG', 'GET', '*']));
  const { token } = await services.token('setup-' + id, [channel]);
  const socket = new WebSocket(process.env.REALTIME_WEBSOCKET_URL);
  const messages = [];
  socket.addEventListener('message', event => {
    for (const line of String(event.data).split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      messages.push(message);
      if (Object.keys(message).length === 0) socket.send('{}');
    }
  });
  const until = async predicate => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('WebSocket verification timed out');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };
  try {
    await until(() => socket.readyState === WebSocket.OPEN);
    socket.send(JSON.stringify({ id: 1, connect: { token } }));
    await until(() => messages.some(message => message.id === 1));
    assert.ok(messages.find(message => message.id === 1).connect?.subs?.[channel]);
    socket.send(JSON.stringify({ id: 2, subscribe: { channel: 'starter/test' } }));
    await until(() => messages.some(message => message.id === 2));
    assert.ok(messages.find(message => message.id === 2).error);
    await services.publish(channel, { type: 'setup.verified' });
    await until(() => messages.some(message => message.push?.pub?.data?.type === 'setup.verified'));
  } finally { socket.close(); }
  console.log('PASS: VM Redis read/write, project isolation, realtime token, WebSocket subscription and event delivery.');
} finally { await services.redis(['DEL', key]); }

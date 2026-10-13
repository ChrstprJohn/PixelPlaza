import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLobbyMusic } from '../src/lobby-music.js';

function fixture() {
  const oscillators = [], gains = [];
  let tick, cleared = false;
  const context = {
    currentTime: 0, state: 'running', destination: {},
    createGain() {
      const gain = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(gain); return gain;
    },
    createOscillator() {
      const voice = { frequency: { value: 0 }, stops: [], connect() {}, disconnect() {}, start(time) { this.started = time; }, stop(time) { this.stops.push(time); } };
      oscillators.push(voice); return voice;
    },
  };
  const timers = { setInterval(callback) { tick = callback; return 1; }, clearInterval() { cleared = true; } };
  return { context, timers, oscillators, gains, advance(time) { context.currentTime = time; tick(); }, get cleared() { return cleared; } };
}

test('lobbies have distinct music, haunted rests remain silent, and stopping cleans up every voice', () => {
  const garden = fixture(), haunted = fixture();
  const stopGarden = startLobbyMusic(garden.context, 'garden', garden.timers);
  const stopHaunted = startLobbyMusic(haunted.context, 'haunted', haunted.timers);
  assert.equal(garden.oscillators[0].type, 'triangle');
  assert.equal(haunted.oscillators[0].type, 'sine');
  assert.notEqual(garden.oscillators[0].frequency.value, haunted.oscillators[0].frequency.value);
  garden.advance(.65); haunted.advance(.95);
  assert.equal(garden.oscillators.length, 3);
  assert.equal(haunted.oscillators.length, 2, 'haunted second beat is a rest');
  stopGarden(); stopHaunted();
  for (const f of [garden, haunted]) {
    assert.equal(f.cleared, true);
    assert.equal(f.gains[0].disconnected, true);
    assert.ok(f.oscillators.every(voice => voice.stops.length === 2), 'all scheduled voices are cancelled');
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterMotion, movementPose } from '../src/character-motion.js';
import art from '../src/directional-art.json' with { type: 'json' };

test('all eight characters use valid dedicated poses and grounded cycles follow distance, not time', () => {
  let count = 0;
  for (const [theme, characters] of Object.entries(characterMotion)) {
    for (const [name, motion] of Object.entries(characters)) {
      count++;
      for (const direction of Object.values(art[theme][name].frames)) {
        assert.ok(motion.frames.every(index => index >= 0 && index < direction.length));
      }
      if (motion.action === 'walk') {
        assert.deepEqual(movementPose(motion, 0, 0), movementPose(motion, 0, 10000), 'blocked characters cannot keep stepping');
        assert.notEqual(movementPose(motion, 0, 0).frame, movementPose(motion, .5, 0).frame, 'both halves have different contact poses');
        assert.equal(movementPose(motion, .5, 0).lift, 0, 'grounded feet do not float');
      }
    }
  }
  assert.equal(count, 8);
});

test('pumpkin walks, ghost hovers, and bat flutters at their own cadence', () => {
  const { cat: ghost, sprout: pumpkin, mushroom: bat } = characterMotion.haunted;
  assert.equal(pumpkin.action, 'walk');
  assert.equal(ghost.action, 'hover');
  assert.equal(bat.action, 'fly');
  assert.notEqual(ghost.cycleMs, bat.cycleMs);
  assert.notEqual(movementPose(bat, 0, 0).frame, movementPose(bat, 0, bat.cycleMs / 2).frame);
  assert.ok(movementPose(ghost, 0, ghost.cycleMs / 4).lift > movementPose(ghost, 0, 0).lift);
  assert.equal(pumpkin.frames.length, 8);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, movePosition, walkable } from '../../shared/world.js';

test('whole character silhouettes stop at fountain and bench artwork in both themes', () => {
  for (const theme of ['garden', 'haunted']) {
    for (const character of CHARACTERS) {
      assert.equal(walkable(503, 500, theme, character), false, `${theme}/${character} overlaps the fountain with its body`);
      assert.equal(walkable(695, 620, theme, character), false, `${theme}/${character} overlaps the bench with its body`);
      assert.equal(walkable(345, 410, theme, character), true, 'clear path beside the fountain stays open');
      assert.equal(walkable(695, 660, theme, character), true, 'clear space below the bench stays open');
      const player = { character, x: 503, y: 550 };
      movePosition(player, 0, -1, 1, theme);
      assert.equal(walkable(player.x, player.y, theme, character), true);
      assert.ok(player.y > 477, 'movement cannot tunnel through the fountain');
    }
  }
});

test('tree canopy does not create a large invisible blocker, but trunks remain solid', () => {
  assert.equal(walkable(300, 70), true);
  assert.equal(walkable(683, 80), true);
  assert.equal(walkable(912, 650), false);
});

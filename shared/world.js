import collisionMasks from './collision-masks.json' with { type: 'json' };

export const WORLD = { width: 960, height: 760, speed: 125, radius: 7 };
export const CHARACTERS = ['cat', 'sprout', 'mushroom', 'robot'];
export const FOUNTAIN = { x: 503, y: 396, radius: 101 };
export const SCENERY = [
  { kind: 'fountain', x: 503, y: 477, height: 220 },
  { kind: 'tree', x: 300, y: 182, height: 205, radius: 18 },
  { kind: 'tree', x: 683, y: 177, height: 205, radius: 18 },
  { kind: 'cherry', x: 92, y: 640, height: 220, radius: 18 },
  { kind: 'tree', x: 912, y: 655, height: 230, radius: 18 },
  { kind: 'bush', x: 192, y: 522, height: 85, radius: 24 },
  { kind: 'bush', x: 872, y: 553, height: 90, radius: 24 },
];
export function facingDirection(dx, dy) {
  return ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
export const OBSTACLES = [
  { x: 0, y: 0, w: 235, h: 170 }, { x: 730, y: 0, w: 230, h: 200 },
  { x: 239, y: 160, w: 105, h: 61 }, { x: 651, y: 174, w: 106, h: 64 },
  { x: 262, y: 512, w: 118, h: 57 }, { x: 641, y: 535, w: 106, h: 57 },
  { x: 0, y: 613, w: 435, h: 147 },
];
function touchesArtwork(x, y, actor, prop, mask, scaleX, scaleY = scaleX) {
  const actorScale = 48 / actor.bodyHeight;
  const actorLeft = x - actor.width * actor.anchorX * actorScale;
  const actorTop = y - actor.height * actor.anchorY * actorScale;
  const propLeft = prop.x - mask.width * mask.anchorX * scaleX;
  const propTop = prop.y - mask.height * mask.anchorY * scaleY;
  if (actorLeft + actor.width * actorScale < propLeft || actorLeft > propLeft + mask.width * scaleX
    || actorTop + actor.height * actorScale < propTop || actorTop > propTop + mask.height * scaleY) return false;
  for (let row = 0; row < actor.height; row++) {
    const actorSpans = actor.rows[row];
    if (!actorSpans.length) continue;
    const top = actorTop + row * actorScale, bottom = top + actorScale;
    const first = Math.max(0, Math.floor((top - propTop) / scaleY));
    const last = Math.min(mask.height - 1, Math.floor((bottom - propTop) / scaleY));
    for (let propRow = first; propRow <= last; propRow++) {
      const spans = mask.rows[propRow];
      for (let a = 0; a < actorSpans.length; a += 2) {
        const left = actorLeft + actorSpans[a] * actorScale, right = actorLeft + actorSpans[a + 1] * actorScale;
        for (let b = 0; b < spans.length; b += 2) {
          if (right > propLeft + spans[b] * scaleX && left < propLeft + spans[b + 1] * scaleX) return true;
        }
      }
    }
  }
  return false;
}

export function walkable(x, y, lobbyId = 'garden', character = 'cat') {
  const r = WORLD.radius;
  const masks = collisionMasks[lobbyId === 'haunted' ? 'haunted' : 'garden'];
  const actor = masks.actors[character] || masks.actors.cat;
  return x >= r && y >= r && x <= WORLD.width - r && y <= WORLD.height - r
    && !SCENERY.some(prop => touchesArtwork(x, y, actor, prop, masks[prop.kind], prop.height / masks[prop.kind].bodyHeight))
    && !OBSTACLES.some((o, index) => index >= 2 && index < 6
      ? touchesArtwork(x, y, actor, { x: o.x + o.w / 2, y: o.y + o.h }, collisionMasks.bench, o.w / collisionMasks.bench.width, o.h / collisionMasks.bench.height)
      : x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r);
}
export function movePosition(player, dx, dy, seconds, lobbyId = 'garden') {
  const length = Math.hypot(dx, dy) || 1;
  const distance = WORLD.speed * seconds;
  const steps = Math.max(1, Math.ceil(distance / 3));
  for (let step = 0; step < steps; step++) {
    const x = player.x + dx / length * distance / steps, y = player.y + dy / length * distance / steps;
    if (walkable(x, player.y, lobbyId, player.character)) player.x = x;
    if (walkable(player.x, y, lobbyId, player.character)) player.y = y;
  }
}

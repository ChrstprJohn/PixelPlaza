export const WORLD = { width: 960, height: 760, speed: 125, radius: 13 };
export const CHARACTERS = ['cat', 'sprout', 'mushroom', 'robot'];
export const OBSTACLES = [
  { x: 0, y: 0, w: 235, h: 170 }, { x: 730, y: 0, w: 230, h: 200 },
  { x: 239, y: 160, w: 105, h: 61 }, { x: 651, y: 174, w: 106, h: 64 },
  { x: 262, y: 512, w: 118, h: 57 }, { x: 641, y: 535, w: 106, h: 57 },
  { x: 0, y: 613, w: 435, h: 147 },
];
export function walkable(x, y) {
  const r = WORLD.radius;
  return x >= r && y >= r && x <= WORLD.width - r && y <= WORLD.height - r
    && Math.hypot(x - 503, y - 396) > 101
    && !OBSTACLES.some(o => x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r);
}
export function movePosition(player, dx, dy, seconds) {
  const length = Math.hypot(dx, dy) || 1;
  const distance = WORLD.speed * seconds;
  const x = player.x + dx / length * distance, y = player.y + dy / length * distance;
  if (walkable(x, player.y)) player.x = x;
  if (walkable(player.x, y)) player.y = y;
}

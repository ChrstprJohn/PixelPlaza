const walkFrames = [0, 1, 2, 4, 5, 6, 7]; // The old frame 3 is a blink, not a walking pose.
const fullCycle = [0, 1, 2, 3, 4, 5, 6, 7];

export const characterMotion = {
  garden: {
    cat: { action: 'walk', stride: 64, frames: walkFrames },
    sprout: { action: 'walk', stride: 44, frames: walkFrames },
    mushroom: { action: 'walk', stride: 50, frames: walkFrames },
    robot: { action: 'walk', stride: 58, frames: walkFrames },
  },
  haunted: {
    cat: { action: 'hover', cycleMs: 1800, lift: 5, bob: 2, frames: walkFrames },
    sprout: { action: 'walk', stride: 54, frames: fullCycle },
    mushroom: { action: 'fly', cycleMs: 320, lift: 5, bob: 1.25, frames: fullCycle },
    robot: { action: 'walk', stride: 62, frames: walkFrames },
  },
};

export function movementPose(motion, distancePhase, time) {
  const phase = motion.action === 'walk' ? distancePhase : time / motion.cycleMs;
  const index = Math.floor((phase % 1) * motion.frames.length);
  return { frame: motion.frames[index], lift: motion.action === 'walk' ? 0 : motion.lift + Math.sin(phase * Math.PI * 2) * motion.bob };
}

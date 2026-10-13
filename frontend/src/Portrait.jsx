import { useEffect, useState } from 'react';
import gardenArt from './character-art.json';
import hauntedArt from './haunted-art.json';

const idleFrames = [0, 1, 0, 2, 0, 3, 0];
const idleDurations = [1900, 350, 700, 350, 1200, 120, 600];

export default function Portrait({ character, animated = false, lobbyId = 'garden' }) {
  const art = lobbyId === 'haunted' ? hauntedArt : gardenArt;
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animated || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let step = 0, timer;
    const next = () => {
      step = (step + 1) % idleFrames.length;
      setFrame(idleFrames[step]);
      timer = setTimeout(next, idleDurations[step]);
    };
    timer = setTimeout(next, idleDurations[0] + Math.random() * 1000);
    return () => clearTimeout(timer);
  }, [animated, character]);
  const name = art.frames[character] ? character : 'cat';
  const crop = art.frames[name][frame];
  const scale = 52 / art.characterHeights[name];
  const width = crop.width * scale, height = crop.height * scale;
  return <svg className="portrait" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
    <svg x={36 - width * crop.anchorX} y={62 - height * crop.anchorY} width={width} height={height} viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} overflow="hidden" preserveAspectRatio="none">
      <image href={art.image} width={art.width} height={art.height}/>
    </svg>
  </svg>;
}

import { useEffect, useRef } from 'react';

export default function PixelReveal() {
  const canvas = useRef(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = canvas.current, hero = node.parentElement;
    const context = node.getContext('2d');
    const picture = new Image();
    picture.src = '/assets/plaza.png';
    let width = 0, height = 0, frame = 0, previous = 0;
    const cells = new Map();
    const size = 32;
    function resize() {
      width = node.clientWidth; height = node.clientHeight;
      const ratio = Math.min(devicePixelRatio, 2);
      node.width = width * ratio; node.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      cells.clear();
    }
    function draw(time) {
      const elapsed = Math.min((time - previous) / 1000, .1); previous = time;
      context.clearRect(0, 0, width, height);
      if (picture.complete && picture.naturalWidth) {
        const scale = Math.max(width / picture.width, height / picture.height);
        const imageWidth = picture.width * scale, imageHeight = picture.height * scale;
        for (const [key, cell] of cells) {
          cell.life -= elapsed * .7;
          if (cell.life <= 0) { cells.delete(key); continue; }
          context.save();
          context.globalAlpha = Math.min(1, cell.life) * .65;
          context.beginPath(); context.rect(cell.x, cell.y, size, size); context.clip();
          context.drawImage(picture, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
          context.restore();
        }
      }
      frame = cells.size ? requestAnimationFrame(draw) : 0;
    }
    function reveal(event) {
      if (event.pointerType === 'touch') return;
      const bounds = node.getBoundingClientRect();
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      if (x < 0 || y < 0 || x > width || y > height) return;
      const column = Math.floor(x / size), row = Math.floor(y / size);
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
        const distance = Math.hypot(dx, dy);
        if (distance > 3.5) continue;
        const px = (column + dx) * size, py = (row + dy) * size;
        cells.set(`${px},${py}`, { x: px, y: py, life: 1.3 - distance * .18 });
      }
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(draw); }
    }
    const observer = new ResizeObserver(resize); observer.observe(hero);
    hero.addEventListener('pointermove', reveal);
    return () => { observer.disconnect(); hero.removeEventListener('pointermove', reveal); cancelAnimationFrame(frame); };
  }, []);
  return <canvas ref={canvas} className="pixel-reveal" aria-hidden="true" />;
}

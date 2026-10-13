import { useEffect, useRef, useState } from 'react';

export default function HeroTitle() {
  const heading = useRef(null), canvas = useRef(null);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false, frame;
    async function start() {
      await document.fonts.ready;
      if (stopped) return;
      const node = heading.current, target = canvas.current;
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
      const source = document.createElement('canvas');
      source.width = target.width = Math.ceil(bounds.width);
      source.height = target.height = Math.ceil(bounds.height);
      const context = source.getContext('2d'), out = target.getContext('2d');
      const size = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.fillStyle = style.color; context.textAlign = 'center'; context.textBaseline = 'middle';
      ['Take a little', 'wander.'].forEach((text, i) => context.fillText(text, bounds.width / 2, line * (i + .5)));
      const sample = document.createElement('canvas'), small = sample.getContext('2d');
      let began;
      setAnimating(true);
      const draw = time => {
        if (stopped) return;
        began ??= time;
        const progress = Math.min(1, (time - began) / 800);
        const pixel = Math.max(1, Math.round(size / 7 * (1 - progress) ** 2));
        sample.width = Math.max(1, Math.ceil(bounds.width / pixel)); sample.height = Math.max(1, Math.ceil(bounds.height / pixel));
        small.drawImage(source, 0, 0, sample.width, sample.height);
        out.clearRect(0, 0, target.width, target.height); out.imageSmoothingEnabled = false;
        out.drawImage(sample, 0, 0, target.width, target.height);
        if (progress < 1) frame = requestAnimationFrame(draw); else setAnimating(false);
      };
      frame = requestAnimationFrame(draw);
    }
    void start();
    const resize = () => { stopped = true; cancelAnimationFrame(frame); setAnimating(false); };
    window.addEventListener('resize', resize, { once: true });
    return () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);
  return <div className={`hero-title ${animating ? 'is-pixelating' : ''}`}><h1 ref={heading}>Take a little<br/>wander.</h1><canvas ref={canvas} aria-hidden="true"/></div>;
}

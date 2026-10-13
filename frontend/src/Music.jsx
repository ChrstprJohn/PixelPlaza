import { useEffect, useRef, useState } from 'react';
import { startLobbyMusic } from './lobby-music.js';

export default function Music({ lobbyId }) {
  const [playing, setPlaying] = useState(false), [error, setError] = useState('');
  const audio = useRef(null);
  useEffect(() => {
    if (!playing || !audio.current) return;
    return startLobbyMusic(audio.current, lobbyId);
  }, [playing, lobbyId]);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);
  async function toggle() {
    try {
      if (!audio.current) audio.current = new (window.AudioContext || window.webkitAudioContext)();
      if (!playing) await audio.current.resume();
      else await audio.current.suspend();
      setPlaying(value => !value); setError('');
    } catch { setError('Audio unavailable'); }
  }
  return <button className="music-toggle" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Mute music' : 'Play music'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>{!playing && <path d="m3 3 18 18"/>}</svg><span>{error || (playing ? 'Music on' : 'Music off')}</span>
  </button>;
}

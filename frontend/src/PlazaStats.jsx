import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function PlazaStats() {
  const [visits, setVisits] = useState(null), [lobbies, setLobbies] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const signal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    async function loadVisits() {
      try {
        const result = await api('/api/visits', { signal: signal() });
        if (!Number.isSafeInteger(result.visits) || result.visits < 0) throw new Error('Invalid visits');
        if (!controller.signal.aborted) setVisits(result.visits);
      } catch { if (!controller.signal.aborted) setVisits(null); }
    }
    async function loadLobbies() {
      try {
        const result = await api('/api/lobbies', { signal: signal() });
        if (!Array.isArray(result.lobbies) || result.lobbies.some(room => typeof room.closed !== 'boolean' || !Number.isSafeInteger(room.players) || room.players < 0)) throw new Error('Invalid lobby counts');
        if (!controller.signal.aborted) setLobbies(result.lobbies);
      } catch { if (!controller.signal.aborted) setLobbies(null); }
    }
    const refresh = () => { if (!document.hidden) { void loadVisits(); void loadLobbies(); } };
    refresh();
    const visitsTimer = setInterval(() => { if (!document.hidden) void loadVisits(); }, 60000);
    const lobbyTimer = setInterval(() => { if (!document.hidden) void loadLobbies(); }, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(visitsTimer); clearInterval(lobbyTimer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const openLobbies = lobbies === null ? null : lobbies.filter(room => !room.closed).length;
  const users = lobbies === null ? null : lobbies.reduce((total, room) => total + room.players, 0);
  return <section className="plaza-stats" aria-label="Plaza activity"><dl>
    {[
      ['Total page visits', visits],
      ['Active lobbies', openLobbies],
      ['Active users', users],
    ].map(([label, count]) => <div key={label}><dt>{label}</dt><dd aria-live="polite" aria-label={count === null ? `${label} unavailable` : undefined}>{count === null ? '—' : count.toLocaleString()}</dd></div>)}
  </dl></section>;
}

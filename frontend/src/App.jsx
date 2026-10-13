import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Centrifuge } from 'centrifuge';
import { api } from './api.js';
const Game = lazy(() => import('./Game.jsx'));
const avatars = [{ id: 'cat', name: 'Milo', color: '#c86135' }, { id: 'sprout', name: 'Fern', color: '#3f7952' }, { id: 'mushroom', name: 'Pip', color: '#c55042' }, { id: 'robot', name: 'Bolt', color: '#327090' }];
function Brand({ onHome }) { return <a className="brand" href="#" onClick={event => { event.preventDefault(); onHome(); }} aria-label="PixelPlaza home"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M14 28V16H5V5h8v5h3V2h12v11H18v15z"/></svg><span>PixelPlaza</span></a>; }
function Portrait({ character }) { return <img className="portrait" src={`/assets/${character}.png`} alt="" />; }

export default function App() {
  const [page, setPage] = useState('landing'), [name, setName] = useState(''), [character, setCharacter] = useState('cat');
  const [session, setSession] = useState(null), [players, setPlayers] = useState([]), [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [draft, setDraft] = useState('');
  const [connection, setConnection] = useState('Connecting'), [delayed, setDelayed] = useState(false);
  const chatEnd = useRef(null), revision = useRef(-1), active = useRef(null), leaveBusy = useRef(false);
  active.current = session;
  function mergeMessages(incoming) { setMessages(old => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.at - b.at).slice(-60)); }
  function applyState(state) { if (state.revision >= revision.current) { revision.current = state.revision; setPlayers(state.players); } if (state.messages) setMessages(old => [...new Map([...state.messages, ...old.filter(m => m.at > (state.historyReadAt || Date.now()))].map(m => [m.id, m])).values()].sort((a, b) => a.at - b.at).slice(-60)); setDelayed(Boolean(state.realtimeDelayed)); }
  async function join(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const result = await api('/api/join', { body: { name, character } });
      revision.current = -1; setMessages(result.messages); applyState(result); setSession(result); setPage('lobby');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function leave() {
    if (leaveBusy.current) return; leaveBusy.current = true;
    const current = active.current;
    if (current) { try { await api('/api/leave', { token: current.sessionToken, body: {} }); } catch { /* Heartbeat timeout releases the slot. */ } }
    setSession(null); setPlayers([]); setMessages([]); setPage('choose'); setError(''); leaveBusy.current = false;
  }
  function failure(e) { if (e.status === 401) { setSession(null); setPage('choose'); setError(e.message); } else if (e.status !== 429) setError(e.message); }
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    const client = new Centrifuge(session.websocketUrl, { token: session.token, getToken: async () => (await api('/api/token', { token: session.sessionToken, body: {} })).token });
    const sync = async () => { try { const state = await api('/api/lobby', { token: session.sessionToken }); if (!disposed) applyState(state); } catch (e) { if (!disposed) failure(e); } };
    client.on('connected', () => { setConnection('Connected'); void sync(); });
    client.on('connecting', () => setConnection('Reconnecting'));
    client.on('disconnected', () => setConnection('Disconnected'));
    client.on('publication', event => { if (event.data.type === 'lobby.state') applyState(event.data); else if (event.data.type === 'chat.message') mergeMessages([event.data.message]); });
    client.connect();
    const heartbeat = setInterval(async () => {
      try { const state = await api('/api/heartbeat', { token: session.sessionToken, body: {} }); if (!disposed) { setDelayed(state.realtimeDelayed); setError(old => old === 'The local server is unavailable. Start the backend and try again.' || old === 'Failed to fetch' ? '' : old); } } catch (e) { if (!disposed) failure(e); }
    }, 10000);
    const resync = setInterval(sync, 10000);
    const visibility = () => { if (!document.hidden) void sync(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; clearInterval(heartbeat); clearInterval(resync); client.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [session]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  useEffect(() => { const unload = () => { const current = active.current; if (current) void fetch('/api/leave', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.sessionToken}` }, body: '{}', keepalive: true }).catch(() => {}); }; window.addEventListener('pagehide', unload); return () => window.removeEventListener('pagehide', unload); }, []);
  async function send(event) {
    event.preventDefault(); if (!draft.trim() || busy) return; setBusy(true); setError('');
    try { const result = await api('/api/chat', { token: session.sessionToken, body: { text: draft } }); mergeMessages([result.message]); setDelayed(result.realtimeDelayed); setDraft(''); } catch (e) { failure(e); } finally { setBusy(false); }
  }
  return <div className={`app ${page === 'lobby' ? 'in-lobby' : ''}`}>
    <header className="topbar"><Brand onHome={async () => { if (session) await leave(); setPage('landing'); setError(''); }} />{page === 'lobby' ? <div className="header-actions"><span className="player-count">{players.length} / 10 players</span><button className="button leave" onClick={leave}>Leave lobby</button></div> : <span className="header-note">A little place to say hello.</span>}</header>
    {page === 'landing' && <main className="landing"><div className="landing-copy"><h1>Take a little<br/>wander.</h1><p>Pick a character, find your spot, and say hello.<br/>A cozy little plaza, shared with up to ten guests.</p><button className="button primary" onClick={() => setPage('choose')}>Go to lobby <span aria-hidden="true">→</span></button><span className="small-note">No account needed. Just bring a name.</span><div className="welcome-avatars">{avatars.map(a => <Portrait key={a.id} character={a.id} />)}</div></div><div className="landing-world"><img src="/assets/plaza.png" alt="A cozy pixel-art garden square with a fountain, cottages and trees" /><div className="world-caption">Meet by the fountain.</div></div></main>}
    {page === 'choose' && <main className="choose-layout"><div className="choose-world" style={{ backgroundImage: 'url(/assets/plaza.png)' }} /><form className="join-form" onSubmit={join}><button type="button" className="text-button" onClick={() => { setPage('landing'); setError(''); }}>Back to the plaza</button><h1>Make yourself<br/>at home.</h1><p>A name, a familiar face, and you're ready.</p><label htmlFor="nickname">Your name</label><input id="nickname" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={18} placeholder="What should we call you?" required autoComplete="nickname"/><fieldset><legend>Choose your character</legend><div className="character-grid">{avatars.map(a => <label key={a.id} className={`character-option ${character === a.id ? 'selected' : ''}`}><input type="radio" name="character" value={a.id} checked={character === a.id} onChange={() => setCharacter(a.id)}/><Portrait character={a.id}/><span>{a.name}</span></label>)}</div></fieldset>{error && <p role="alert" className="error">{error}</p>}<button className="button primary" disabled={busy || name.trim().length < 2}>{busy ? 'Joining the plaza…' : 'Enter the plaza'}</button><small>Walk with WASD or arrow keys. Chat with the people you meet.</small></form></main>}
    {page === 'lobby' && session && <main className="lobby-layout"><section className="world-section" aria-label="Plaza"><Suspense fallback={<div className="loading-world">Opening the plaza…</div>}><Game players={players} selfId={session.playerId} messages={messages} onMove={body => api('/api/move', { token: session.sessionToken, body })} onError={failure}/></Suspense></section><aside className="chat-panel"><div className="chat-heading"><h1>Lobby chat</h1><span className={`connection ${connection === 'Connected' ? 'online' : ''}`}>{delayed ? 'Updates delayed' : connection}</span></div><div className="messages" role="log" aria-live="polite" aria-relevant="additions">{messages.length === 0 && <div className="chat-empty"><Portrait character="sprout"/><p>A little hello goes a long way.</p><span>Be the first to say something.</span></div>}{messages.map(m => <div className="message" key={m.id}><Portrait character={m.character}/><p><strong style={{ color: avatars.find(a => a.id === m.character)?.color }}>{m.name}:</strong> {m.text}</p></div>)}<div ref={chatEnd}/></div><div className="chat-bottom">{error && <p className="error" role="alert">{error}</p>}<form className="chat-form" onSubmit={send}><label className="sr-only" htmlFor="chat-input">Your message</label><input id="chat-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say hello…" maxLength={200} autoComplete="off"/><button className="button primary" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send'}</button></form><small>Messages disappear after 15 minutes of quiet.</small></div></aside></main>}
  </div>;
}

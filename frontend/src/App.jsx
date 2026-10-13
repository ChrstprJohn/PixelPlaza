import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Centrifuge } from 'centrifuge';
import { api, apiUrl } from './api.js';
import PixelReveal from './PixelReveal.jsx';
import Portrait from './Portrait.jsx';
import { LOBBIES } from '../../shared/lobbies.js';
import Music from './Music.jsx';
import HeroTitle from './HeroTitle.jsx';
const Game = lazy(() => import('./Game.jsx'));
const gardenAvatars = [{ id: 'cat', name: 'Milo', color: '#c86135' }, { id: 'sprout', name: 'Fern', color: '#3f7952' }, { id: 'mushroom', name: 'Pip', color: '#c55042' }, { id: 'robot', name: 'Bolt', color: '#327090' }];
function Brand({ onHome }) { return <a className="brand" href="#" onClick={event => { event.preventDefault(); onHome(); }} aria-label="PixelPlaza home"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M14 28V16H5V5h8v5h3V2h12v11H18v15z"/></svg><span>PixelPlaza</span></a>; }

export default function App() {
  const [page, setPage] = useState('landing'), [name, setName] = useState(''), [character, setCharacter] = useState('cat');
  const [session, setSession] = useState(null), [players, setPlayers] = useState([]), [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [draft, setDraft] = useState('');
  const [connection, setConnection] = useState('Connecting'), [delayed, setDelayed] = useState(false);
  const [landingScrolled, setLandingScrolled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    if (!chatOpen) return;
    const closeOutside = event => {
      if (event.target.closest('.chat-hud')) return;
      setChatOpen(false);
      if (event.target.closest('.lobby-layout')) requestAnimationFrame(() => document.querySelector('.game-canvas canvas')?.focus());
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [chatOpen]);
  const [lobbyId, setLobbyId] = useState('garden'), [lobbies, setLobbies] = useState([]), [roomsLoading, setRoomsLoading] = useState(true);
  const avatars = lobbyId === 'haunted' ? [{ id: 'cat', name: 'Wisp', color: '#a993d0' }, { id: 'sprout', name: 'Gourd', color: '#c87532' }, { id: 'mushroom', name: 'Fang', color: '#9a74bc' }, { id: 'robot', name: 'Bones', color: '#4eafbc' }] : gardenAvatars;
  const selectedLobby = LOBBIES.find(room => room.id === lobbyId);
  const [transition, setTransition] = useState('');
  const transitionTimer = useRef(null);
  useEffect(() => () => clearTimeout(transitionTimer.current), []);
  function revealLobby() {
    setTransition('opening');
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setTransition(''), 1400);
  }
  useEffect(() => {
    if (!['rooms', 'choose'].includes(page)) return;
    let disposed = false;
    const load = async () => {
      try { const result = await api('/api/lobbies'); if (!disposed) { setLobbies(result.lobbies); setError(''); } }
      catch (e) { if (!disposed) setError(e.message); }
      finally { if (!disposed) setRoomsLoading(false); }
    };
    void load(); const timer = setInterval(load, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [page]);
  const chatEnd = useRef(null), revision = useRef(-1), active = useRef(null), leaveBusy = useRef(false);
  active.current = session;
  useEffect(() => { const sync = () => setLandingScrolled(window.scrollY > 8); sync(); window.addEventListener('scroll', sync, { passive: true }); return () => window.removeEventListener('scroll', sync); }, []);
  function mergeMessages(incoming) { setMessages(old => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.at - b.at).slice(-60)); }
  function applyState(state) { if (state.revision >= revision.current) { revision.current = state.revision; setPlayers(state.players); } if (state.messages) setMessages(old => [...new Map([...state.messages, ...old.filter(m => m.at > (state.historyReadAt || Date.now()))].map(m => [m.id, m])).values()].sort((a, b) => a.at - b.at).slice(-60)); setDelayed(Boolean(state.realtimeDelayed)); }
  async function join(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setTransition('closing');
    try {
      const [result] = await Promise.all([api('/api/join', { body: { name, character, lobbyId } }), new Promise(resolve => setTimeout(resolve, 1100))]);
      revision.current = -1; setMessages(result.messages); applyState(result); setSession(result); setChatOpen(false); setPage('lobby');
    } catch (e) { setError(e.message); setTransition(''); } finally { setBusy(false); }
  }
  async function leave() {
    if (leaveBusy.current) return; leaveBusy.current = true;
    const current = active.current;
    if (current) { try { await api('/api/leave', { token: current.sessionToken, body: {} }); } catch { /* Heartbeat timeout releases the slot. */ } }
    setSession(null); setPlayers([]); setMessages([]); setPage('rooms'); setError(''); leaveBusy.current = false;
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
      try { const state = await api('/api/heartbeat', { token: session.sessionToken, body: {} }); if (!disposed) { setDelayed(state.realtimeDelayed); setError(old => old === 'Unable to reach the plaza server. Please try again.' || old === 'Failed to fetch' ? '' : old); } } catch (e) { if (!disposed) failure(e); }
    }, 10000);
    const resync = setInterval(sync, 10000);
    const visibility = () => { if (!document.hidden) void sync(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; clearInterval(heartbeat); clearInterval(resync); client.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [session]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  useEffect(() => { const unload = () => { const current = active.current; if (current) void fetch(apiUrl('/api/leave'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.sessionToken}` }, body: '{}', keepalive: true }).catch(() => {}); }; window.addEventListener('pagehide', unload); return () => window.removeEventListener('pagehide', unload); }, []);
  async function send(event) {
    event.preventDefault(); if (!draft.trim() || busy) return; setBusy(true); setError('');
    try { const result = await api('/api/chat', { token: session.sessionToken, body: { text: draft } }); mergeMessages([result.message]); setDelayed(result.realtimeDelayed); setDraft(''); document.getElementById('chat-input')?.focus(); } catch (e) { failure(e); } finally { setBusy(false); }
  }
  function toggleChat() {
    const next = !chatOpen;
    setChatOpen(next);
    requestAnimationFrame(() => next ? document.getElementById('chat-input')?.focus() : document.querySelector('.game-canvas canvas')?.focus());
  }
  return <div className={`app ${page === 'lobby' ? 'in-lobby' : page === 'landing' ? 'on-landing' : ''}`}>
    {page === 'landing' && <PixelReveal/>}{page !== 'lobby' && <header className={`topbar ${page === 'landing' && landingScrolled ? 'is-scrolled' : ''}`}><Brand onHome={async () => { if (session) await leave(); setPage('landing'); setError(''); }} /></header>}
    {page === 'landing' && <><main><section className="landing" aria-label="Welcome to PixelPlaza"><div className="landing-copy"><HeroTitle/><p>Pick a character, wander around, and say hello.</p><button className="button primary" onClick={() => { setRoomsLoading(true); setPage('rooms'); }}>Go to lobby <svg className="landing-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></button><div className="welcome-avatars" aria-hidden="true">{gardenAvatars.map(a => <Portrait key={a.id} character={a.id} animated/>)}</div></div></section><section className="plaza-stats" aria-label="Plaza activity"><dl><div><dt>Mock total visits</dt><dd>1,248</dd></div><div><dt>Mock active lobbies</dt><dd>1</dd></div><div><dt>Mock active users</dt><dd>7</dd></div></dl></section></main><footer className="landing-footer"><Brand onHome={() => window.scrollTo({ top: 0, behavior: 'instant' })}/><span className="footer-credit">made by <strong>.dcd</strong></span></footer></>}
    {page === 'choose' && <main className="choose-layout"><form className="join-form" onSubmit={join}><button type="button" className="text-button" onClick={() => { setPage('rooms'); setError(''); }}><svg className="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14"/></svg>Change lobby</button><h1>Choose your avatar</h1><p>Enter your name and choose a character for {selectedLobby.name}.</p><label htmlFor="nickname">Your name</label><input id="nickname" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={18} placeholder="What should we call you?" required autoComplete="nickname"/><fieldset><legend>Choose your character</legend><div className="character-grid">{avatars.map(a => <label key={a.id} className={`character-option ${character === a.id ? 'selected' : ''}`}><input type="radio" name="character" value={a.id} checked={character === a.id} onChange={() => setCharacter(a.id)}/><Portrait character={a.id} animated lobbyId={lobbyId}/><span>{a.name}</span></label>)}</div></fieldset>{error && <p role="alert" className="error">{error}</p>}<button className="button primary" disabled={busy || name.trim().length < 2 || roomsLoading || !lobbies.length || lobbies.find(room => room.id === lobbyId)?.full}>{busy ? 'Joining the plaza…' : 'Enter the plaza'}<svg className="join-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></button></form></main>}
    {page === 'rooms' && <main className="room-picker">
      <button className="text-button" onClick={() => { setPage('landing'); setError(''); }}>Back to the plaza</button>
      <h1>Choose a lobby</h1>
      {roomsLoading && <p role="status">Loading lobbies…</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="room-list">{LOBBIES.map(info => {
        const room = lobbies.find(room => room.id === info.id);
        return <button key={info.id} className={`room-option ${info.theme}`} disabled={!room || room.full} onClick={() => { setLobbyId(info.id); setPage('choose'); setError(''); }}>
          <img src={info.map} alt="" width="480" height="380"/>
          <div className="room-details"><h2>{info.name}</h2><p>{info.description}</p><div className="room-availability"><span>{room ? `${room.players} / ${room.limit} players` : 'Unavailable'}</span><strong>{room ? room.full ? 'Full' : 'Join lobby' : 'Checking…'}</strong></div></div>
        </button>;
      })}</div>
    </main>}
    {page === 'lobby' && session && <main className={`lobby-layout ${selectedLobby.theme}`}>
      <section className="world-section" aria-label="Plaza"><Suspense fallback={<div className="loading-world">Opening the plaza…</div>}>
        <Game lobbyId={session.lobbyId || lobbyId} onReady={revealLobby} players={players} selfId={session.playerId} messages={messages} controlsPaused={chatOpen || Boolean(transition)} onMove={body => api('/api/move', { token: session.sessionToken, body })} onError={failure}/>
      </Suspense></section>
      <div className="chat-hud">
        {!chatOpen && <>
          <button className="chat-hud-toggle" onClick={toggleChat} aria-expanded="false" aria-controls="lobby-chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-4 3V11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z"/><path d="M7 10h7M7 14h4"/></svg>
            <span>Chat</span><span className="player-count" aria-label={`${players.length} of ${session.limit || 10} players`}>{players.length} / {session.limit || 10}</span>
          </button>
          <div className="chat-preview" role="log" aria-label="Recent messages" aria-live="polite">{messages.slice(-3).map(m => <div className="preview-message" key={m.id}><Portrait character={m.character} lobbyId={lobbyId}/><p><strong>{m.name}</strong> {m.text}</p></div>)}</div>
          {(error || delayed || connection !== 'Connected') && <p className="hud-status" role="status">{error || (delayed ? 'Updates delayed' : connection)}</p>}
        </>}
        {chatOpen && <aside id="lobby-chat" className="chat-panel chat-open" aria-label="Lobby chat">
          <div className="chat-heading"><div className="chat-title"><h1>Chat</h1><span className="player-count">{players.length} / {session.limit || 10} players</span></div><button className="chat-close" onClick={toggleChat} aria-label="Close chat and resume movement"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
          {(delayed || connection !== 'Connected') && <p className="connection chat-status" role="status">{delayed ? 'Updates delayed' : connection}</p>}
          <div className="messages" role="log" aria-live="polite" aria-relevant="additions">{messages.length === 0 && <p className="chat-empty-label">No messages yet.</p>}{messages.map(m => <div className="message" key={m.id}><Portrait character={m.character} lobbyId={lobbyId}/><p><strong style={{ color: avatars.find(a => a.id === m.character)?.color }}>{m.name}:</strong> {m.text}</p></div>)}<div ref={chatEnd}/></div>
          <div className="chat-bottom">{error && <p className="error" role="alert">{error}</p>}<form className="chat-form" onSubmit={send}><label className="sr-only" htmlFor="chat-input">Your message</label><input id="chat-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say hello…" maxLength={200} autoComplete="off"/><button className="button primary" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send'}</button></form></div>
        </aside>}
      </div>
      <button className="lobby-exit" onClick={leave}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13"/></svg>Leave</button>
      <Music lobbyId={session.lobbyId || lobbyId}/>
    </main>}
    {transition && <div className={`join-transition ${transition} ${selectedLobby.theme}`} role="status"><div className="cloud-curtain cloud-left"/><div className="cloud-curtain cloud-right"/><span>{transition === 'closing' ? `Joining ${selectedLobby.name}…` : selectedLobby.name}</span></div>}
  </div>;
}

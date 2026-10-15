import { useEffect, useRef, useState } from 'react';
import Portrait from './Portrait.jsx';
import './admin.css';

async function request(path, body) {
  let response;
  try {
    response = await fetch(`/api/admin/${path}`, { credentials: 'same-origin', signal: AbortSignal.timeout(12000), ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  } catch { throw new Error('Cannot reach the server. Try again.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Admin API is unavailable. Check the backend deployment.'); }
  if (!response.ok) { const error = new Error(data.error || 'Request failed. Try again.'); error.status = response.status; throw error; }
  return data;
}
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14"/></svg>;

function AnalyticsDashboard() {
  const frame = useRef(null);
  const [dashboard, setDashboard] = useState(null), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0), [loaded, setLoaded] = useState(false), [height, setHeight] = useState(900);
  useEffect(() => {
    let disposed = false;
    setDashboard(null); setError(''); setLoaded(false); setHeight(900);
    request('dashboard').then(data => { if (!disposed) setDashboard(data); }).catch(error => { if (!disposed) setError(error.message); });
    return () => { disposed = true; };
  }, [attempt]);
  const embedUrl = dashboard?.embedUrl;
  useEffect(() => {
    if (!embedUrl) return;
    const origin = new URL(embedUrl).origin;
    const resize = event => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || event.data?.event !== 'posthog:dimensions' || event.data.name !== 'PixelPlazaAnalytics') return;
      const next = Number(event.data.height);
      if (Number.isFinite(next) && next > 0 && next < 100000) setHeight(Math.ceil(next));
    };
    window.addEventListener('message', resize);
    return () => window.removeEventListener('message', resize);
  }, [embedUrl]);
  return <section className="admin-dashboard" aria-labelledby="analytics-heading">
    <h2 id="analytics-heading">Analytics</h2>
    {error ? <div className="admin-analytics"><p className="error" role="alert">{error}</p><button className="text-button" onClick={() => setAttempt(value => value + 1)}>Retry analytics</button></div>
      : !dashboard ? <p role="status">Loading analytics…</p>
      : !embedUrl ? <div className="admin-analytics"><p>Connect your PixelPlaza dashboard to view analytics here.</p><p>Add its shared or embedded URL to the backend’s dashboard setting, then restart the backend.</p><a href="https://us.posthog.com/project/643035" target="_blank" rel="noopener noreferrer">Open PostHog</a></div>
      : <><div className="admin-analytics-actions"><p>{loaded ? 'PixelPlaza dashboard' : 'Loading dashboard…'}</p><a href={embedUrl} target="_blank" rel="noopener noreferrer">Open dashboard in new tab</a></div><iframe ref={frame} key={attempt} name="PixelPlazaAnalytics" title="PixelPlaza PostHog analytics dashboard" className="admin-dashboard-frame" src={embedUrl} style={{ height }} onLoad={() => setLoaded(true)} referrerPolicy="no-referrer" scrolling="no" /></>}
  </section>;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false), [checking, setChecking] = useState(true), [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState(''), [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [rooms, setRooms] = useState(null), [tab, setTab] = useState('lobbies'), [confirm, setConfirm] = useState(null);
  async function refresh() {
    try { const data = await request('lobbies'); setRooms(data.lobbies); setError(''); }
    catch (error) { if (error.status === 401) { setAuthenticated(false); setRooms(null); } setError(error.message); }
  }
  useEffect(() => {
    let disposed = false;
    request('session').then(data => { if (!disposed) { setAuthenticated(data.authenticated); setConfigured(data.configured); } }).catch(error => { if (!disposed) setError(error.message); }).finally(() => { if (!disposed) setChecking(false); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const interval = setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 5000);
    return () => clearInterval(interval);
  }, [authenticated, busy]);
  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('login', { password }); setPassword(''); setAuthenticated(true); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try { await request('logout', {}); setAuthenticated(false); setRooms(null); setNotice(''); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function manage(room, action, player) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request('lobbies', { lobbyId: room.id, action, ...(player ? { playerId: player.id } : {}) });
      setConfirm(null);
      await refresh();
      setNotice(action === 'remove' ? `${player.name} was removed from ${room.name}.` : `${room.name} is ${action === 'open' ? 'open' : 'closed to new players'}.`);
    } catch (error) { if (error.status === 401) setAuthenticated(false); setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="admin-shell">
    <header className="admin-header"><a className="brand" href="/"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M14 28V16H5V5h8v5h3V2h12v11H18v15z"/></svg><span>PixelPlaza</span></a><a className="admin-back" href="/"><Arrow/>Back to plaza</a></header>
    {!authenticated ? <main className="admin-signin"><form onSubmit={signIn} aria-busy={checking || busy}>
      <h1>Admin sign in</h1><p>Manage your lobbies.</p>
      <label htmlFor="admin-password">Password</label><div className="admin-password"><input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={256} required disabled={checking || busy || !configured}/><button type="button" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{show && <path d="m3 3 18 18"/>}</svg></button></div>
      {!configured && <p className="error" role="alert">Set ADMIN_PASSWORD in the backend environment to enable sign in.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary" disabled={checking || busy || !password || !configured}>{checking ? 'Checking session…' : busy ? 'Signing in…' : 'Sign in'}</button>
    </form></main> : <main className="admin-main">
      <div className="admin-title"><h1>Plaza management</h1><button className="text-button" disabled={busy} onClick={signOut}>Sign out</button></div>
      <nav className="admin-tabs" aria-label="Admin sections"><button aria-current={tab === 'lobbies' ? 'page' : undefined} onClick={() => setTab('lobbies')}>Lobbies</button><button aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => setTab('analytics')}>Analytics</button></nav>
      {error && <p className="error" role="alert">{error} <button className="text-button" disabled={busy} onClick={refresh}>Retry</button></p>}
      <p className="admin-notice" role="status">{notice}</p>
      {tab === 'lobbies' ? <section aria-label="Lobby management">
        <div className="admin-section-heading"><p>{rooms ? `${rooms.reduce((sum, room) => sum + room.players, 0)} online across ${rooms.length} lobbies` : 'Loading lobbies…'}</p><button className="text-button" disabled={busy} onClick={refresh}>Refresh</button></div>
        {rooms?.map(room => <article className="admin-room" key={room.id}>
          <div className="admin-room-heading"><img src={room.map} alt="" width="112" height="88"/><div><h2>{room.name}</h2><p><span className={`admin-status ${room.closed ? 'closed' : ''}`}>{room.closed ? 'Closed' : 'Open'}</span><span>{room.players} / {room.limit} players</span></p></div><button className={`button ${room.closed ? 'primary' : 'admin-secondary'}`} disabled={busy} onClick={() => manage(room, room.closed ? 'open' : 'close')}>{room.closed ? 'Open lobby' : 'Close lobby'}</button></div>
          {room.closed && <p className="admin-closed-note">New joins are paused. Players already inside can stay.</p>}
          {room.members.length ? <ul className="admin-members" aria-label={`${room.name} players`}>{room.members.map(player => <li key={player.id}><Portrait character={player.character} lobbyId={room.id}/><span className="admin-player-name">{player.name}</span>{confirm === player.id ? <div className="admin-remove-confirm"><span>Remove player?</span><button className="admin-remove" disabled={busy} onClick={() => manage(room, 'remove', player)}>Remove</button><button className="text-button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div> : <button className="admin-remove" disabled={busy} onClick={() => setConfirm(player.id)} aria-label={`Remove ${player.name} from ${room.name}`}>Remove</button>}</li>)}</ul> : <p className="admin-empty">No players in this lobby.</p>}
        </article>)}
      </section> : <AnalyticsDashboard/>}
    </main>}
  </div>;
}

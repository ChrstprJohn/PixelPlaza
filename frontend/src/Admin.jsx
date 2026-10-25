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
const LobbyIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11h-6v-6h-4v6z"/></svg>;
const AnalyticsIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-7"/></svg>;

function ActionDialog({ confirmation, busy, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (!confirmation || !dialog.current) return;
    const opener = confirmation.opener;
    dialog.current.showModal();
    return () => {
      if (dialog.current?.open) dialog.current.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [confirmation]);
  if (!confirmation) return null;

  const { room, action, player } = confirmation;
  const isSignOut = action === 'signout';
  const isRemove = action === 'remove';
  const isOpening = action === 'open';
  const title = isSignOut ? 'Sign out of admin?' : isRemove ? `Remove ${player.name}?` : `${isOpening ? 'Open' : 'Close'} ${room.name}?`;
  const description = isRemove
    ? `${player.name} will leave this lobby and can join again if the lobby is accepting players.`
    : isSignOut
      ? 'You will return to the admin sign-in screen and need your password to sign in again.'
      : isOpening
      ? `Players will be able to join ${room.name} again, up to ${room.limit} players.`
      : `New players will not be able to join ${room.name}. Anyone already inside can keep playing.`;
  const confirmLabel = isSignOut ? 'Sign out' : isRemove ? 'Remove player' : isOpening ? 'Open lobby' : 'Close lobby';
  const confirmClass = isRemove || action === 'close' ? 'danger' : isOpening ? 'primary' : 'admin-secondary';

  return <dialog className="admin-dialog" ref={dialog} aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={event => { if (event.target === dialog.current && !busy) onCancel(); }}>
    <div className="admin-dialog-content">
      <p className="admin-dialog-kicker">{isSignOut ? 'Admin session' : isRemove ? 'Player action' : 'Lobby access'}</p>
      <h2 id="admin-dialog-title">{title}</h2>
      <p id="admin-dialog-description">{description}</p>
      <div className="admin-dialog-actions">
        <button className="button admin-secondary" type="button" disabled={busy} autoFocus onClick={onCancel}>Cancel</button>
        <button className={`button ${confirmClass}`} type="button" disabled={busy} onClick={onConfirm}>
          {busy ? (isSignOut ? 'Signing out…' : isRemove ? 'Removing…' : isOpening ? 'Opening…' : 'Closing…') : confirmLabel}
        </button>
      </div>
    </div>
  </dialog>;
}

function AdminToast({ toast, onDismiss }) {
  if (!toast) return null;
  return <div className={`admin-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
    <span className="admin-toast-mark" aria-hidden="true">{toast.kind === 'error' ? '!' : '✓'}</span>
    <p>{toast.message}</p>
    <button type="button" aria-label="Dismiss alert" onClick={onDismiss}>×</button>
  </div>;
}

function AnalyticsDashboard({ onError }) {
  const frame = useRef(null);
  const [dashboard, setDashboard] = useState(null), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0), [height, setHeight] = useState(900);
  useEffect(() => {
    let disposed = false;
    setDashboard(null); setError(''); setHeight(900);
    request('dashboard').then(data => { if (!disposed) setDashboard(data); }).catch(error => { if (!disposed) { setError(error.message); onError(error.message); } });
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
  return <section className="admin-dashboard" aria-label="PixelPlaza analytics">
    {error ? <div className="admin-analytics"><button className="text-button" onClick={() => setAttempt(value => value + 1)}>Retry analytics</button></div>
      : !dashboard ? <p role="status">Loading analytics…</p>
      : !embedUrl ? <div className="admin-analytics"><p>Connect your PixelPlaza dashboard to view analytics here.</p><p>Add its shared or embedded URL to the backend’s dashboard setting, then restart the backend.</p><a href="https://us.posthog.com/project/643035" target="_blank" rel="noopener noreferrer">Open PostHog</a></div>
      : <iframe ref={frame} key={attempt} name="PixelPlazaAnalytics" title="PixelPlaza PostHog analytics dashboard" className="admin-dashboard-frame" src={embedUrl} style={{ height }} referrerPolicy="no-referrer" scrolling="no" />}
  </section>;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false), [checking, setChecking] = useState(true), [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState(''), [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null), [rooms, setRooms] = useState(null), [tab, setTab] = useState('lobbies'), [confirm, setConfirm] = useState(null), [menuOpen, setMenuOpen] = useState(false);
  const toastSequence = useRef(0);
  const menuButton = useRef(null);
  function notify(kind, message, source = 'admin') {
    setToast({ kind, message, source, id: ++toastSequence.current });
  }
  async function refresh() {
    try {
      const data = await request('lobbies');
      setRooms(data.lobbies);
      setToast(current => current?.source === 'lobbies' && current.kind === 'error' ? null : current);
      return true;
    } catch (error) { if (error.status === 401) { setAuthenticated(false); setRooms(null); } notify('error', error.message, 'lobbies'); return false; }
  }
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(current => current?.id === toast.id ? null : current), toast.kind === 'success' ? 6000 : 12000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = event => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => { window.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);
  useEffect(() => {
    let disposed = false;
    request('session').then(data => { if (!disposed) { setAuthenticated(data.authenticated); setConfigured(data.configured); } }).catch(error => { if (!disposed) notify('error', error.message, 'session'); }).finally(() => { if (!disposed) setChecking(false); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const interval = setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 5000);
    return () => clearInterval(interval);
  }, [authenticated, busy]);
  async function signIn(event) {
    event.preventDefault(); setBusy(true);
    try { await request('login', { password }); setPassword(''); setAuthenticated(true); setToast(null); }
    catch (error) { notify('error', error.message, 'signin'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try { await request('logout', {}); setAuthenticated(false); setRooms(null); setToast(null); setConfirm(null); }
    catch (error) { notify('error', error.message, 'signout'); setConfirm(null); }
    finally { setBusy(false); }
  }
  function askToManage(room, action, player, event) {
    setConfirm({ room, action, player, opener: event.currentTarget });
  }
  function askToSignOut(event) {
    setConfirm({ action: 'signout', opener: event.currentTarget });
  }
  async function manage() {
    if (!confirm) return;
    const { room, action, player } = confirm;
    setBusy(true);
    try {
      await request('lobbies', { lobbyId: room.id, action, ...(player ? { playerId: player.id } : {}) });
      const refreshed = await refresh();
      if (refreshed) notify('success', action === 'remove' ? `${player.name} was removed from ${room.name}.` : `${room.name} is now ${action === 'open' ? 'open' : 'closed'} to new players.`);
      setConfirm(null);
    } catch (error) { if (error.status === 401) { setAuthenticated(false); setConfirm(null); } notify('error', error.message, 'action'); }
    finally { setBusy(false); }
  }
  const chooseTab = section => { setTab(section); if (menuOpen) menuButton.current?.focus(); setMenuOpen(false); };
  return <div className={`admin-shell ${authenticated ? 'is-authenticated' : ''}`}>
    {!authenticated ? <main className="admin-signin"><div className="admin-signin-content"><a className="admin-back" href="/"><Arrow/>Back to plaza</a><form onSubmit={signIn} aria-busy={checking || busy}>
      <h1>Admin sign in</h1>
      <label htmlFor="admin-password">Password</label><div className="admin-password"><input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={256} required disabled={checking || busy || !configured}/><button type="button" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{show && <path d="m3 3 18 18"/>}</svg></button></div>
      {!configured && <p className="error" role="alert">Set ADMIN_PASSWORD in the backend environment to enable sign in.</p>}
      <button className="button primary" disabled={checking || busy || !password || !configured}>{checking ? 'Checking session…' : busy ? 'Signing in…' : 'Sign in'}</button>
    </form></div></main> : <>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand-lockup"><a className="brand" href="/" aria-label="PixelPlaza home"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M14 28V16H5V5h8v5h3V2h12v11H18v15z"/></svg><span className="admin-brand-name"><span>PixelPlaza</span><span className="admin-brand-subtitle">Admin management</span></span></a></div>
        <div className="admin-mobile-bar"><div className="admin-brand-lockup"><a className="brand" href="/" aria-label="PixelPlaza home"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M14 28V16H5V5h8v5h3V2h12v11H18v15z"/></svg><span className="admin-brand-name"><span>PixelPlaza</span><span className="admin-brand-subtitle">Admin management</span></span></a></div><button ref={menuButton} className="admin-menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="admin-mobile-navigation" onClick={() => setMenuOpen(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={menuOpen ? 'M5 5l14 14M19 5L5 19' : 'M3 6h18M3 12h18M3 18h18'}/></svg></button></div>
        {menuOpen && <button className="admin-menu-backdrop" type="button" aria-label="Close admin menu" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} />}
        <nav id="admin-mobile-navigation" className={`admin-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Admin navigation">
          <div className="admin-drawer-heading"><span>Menu</span><button type="button" aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}>×</button></div>
          <button className="admin-nav-link" aria-current={tab === 'lobbies' ? 'page' : undefined} onClick={() => chooseTab('lobbies')}><LobbyIcon/><span>Lobbies</span></button>
          <button className="admin-nav-link" aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => chooseTab('analytics')}><AnalyticsIcon/><span>Analytics</span></button>
          <div className="admin-mobile-nav-footer"><a className="admin-nav-link" href="/"><Arrow/><span>Back to plaza</span></a><button className="admin-nav-link" disabled={busy} onClick={askToSignOut}><span className="admin-signout-icon" aria-hidden="true">↪</span><span>Sign out</span></button></div>
        </nav>
        <div className="admin-sidebar-footer"><a className="admin-sidebar-link" href="/"><Arrow/><span>Back to plaza</span></a><button className="admin-sidebar-link" disabled={busy} onClick={askToSignOut}><span className="admin-signout-icon" aria-hidden="true">↪</span><span>Sign out</span></button></div>
      </aside>
      <main id="admin-main" className="admin-main">
        <div className="admin-page-heading"><h1>{tab === 'lobbies' ? 'Lobbies' : 'Analytics'}</h1>{tab === 'lobbies' && <button className="button admin-secondary admin-refresh" disabled={busy} onClick={refresh}>Refresh</button>}</div>
      {tab === 'lobbies' ? <section className="admin-lobbies" aria-label="Lobby management">
        <div className="admin-section-heading"><p>{rooms ? <><strong>{rooms.reduce((sum, room) => sum + room.players, 0)} online</strong><span aria-hidden="true"> · </span>{rooms.filter(room => !room.closed).length} open {rooms.filter(room => !room.closed).length === 1 ? 'lobby' : 'lobbies'}</> : 'Loading lobby activity…'}</p></div>
        {rooms?.map(room => <article className="admin-room" key={room.id}>
          <div className="admin-room-heading"><img src={room.map} alt="" width="112" height="88"/><div className="admin-room-details"><h2>{room.name}</h2><p className="admin-room-meta"><span className={`admin-status ${room.closed ? 'closed' : ''}`}><span className="admin-status-dot" aria-hidden="true"/>{room.closed ? 'Lobby closed' : 'Lobby open'}</span><span>{room.players} of {room.limit} players</span></p></div><button className={`button ${room.closed ? 'primary' : 'admin-close'}`} disabled={busy} onClick={event => askToManage(room, room.closed ? 'open' : 'close', null, event)}>{room.closed ? 'Open lobby' : 'Close lobby'}</button></div>
          {room.members.length ? <><div className="admin-members-heading"><h3>Players in this lobby</h3><span>{room.members.length}</span></div><ul className="admin-members" aria-label={`${room.name} players`}>{room.members.map(player => <li key={player.id}><Portrait character={player.character} lobbyId={room.id}/><span className="admin-player-name">{player.name}</span><button className="admin-remove" disabled={busy} onClick={event => askToManage(room, 'remove', player, event)} aria-label={`Remove ${player.name} from ${room.name}`}>Remove</button></li>)}</ul></> : <p className="admin-empty">No players here right now.</p>}
        </article>)}
      </section> : <AnalyticsDashboard onError={message => notify('error', message, 'analytics')}/>}
      </main>
      <ActionDialog confirmation={confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => confirm?.action === 'signout' ? signOut() : manage()}/>
    </>}
    <div className="admin-toasts"><AdminToast toast={toast} onDismiss={() => setToast(null)}/></div>
  </div>;
}

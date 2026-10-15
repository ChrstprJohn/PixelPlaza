import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { ApiError } from './lobby.js';

const duration = 8 * 60 * 60;
const cookieName = 'pixelplaza_admin';
const digest = value => createHash('sha256').update(value).digest();
export function createAdmin({ lobby, env = process.env, now = Date.now }) {
  let attempts = 0, windowStart = now();
  const configured = () => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 16 && env.ADMIN_PASSWORD.length <= 256 && (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length >= 32);
  const signature = value => createHmac('sha256', env.ADMIN_SESSION_SECRET || digest(`pixelplaza-admin:${env.ADMIN_PASSWORD}`)).update(`${value}:${env.ADMIN_PASSWORD}`).digest('base64url');
  const equal = (a, b) => { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
  const authenticated = request => {
    if (!configured()) return false;
    const token = request.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const [value, mac, extra] = (token || '').split('.');
    if (!value || !mac || extra || !equal(signature(value), mac)) return false;
    const expiry = Number(value.split(':')[0]);
    return Number.isSafeInteger(expiry) && expiry > now() / 1000 && expiry <= now() / 1000 + duration;
  };
  const cookie = token => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${token ? duration : 0}${env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return async (request, response, send, readBody) => {
    if (request.method === 'GET' && request.url === '/api/admin/session') return send(200, { authenticated: authenticated(request), configured: configured() });
    if (!configured()) throw new ApiError(503, 'Set ADMIN_PASSWORD on the backend to enable admin sign in (16–256 characters).');
    if (request.method === 'POST' && request.url === '/api/admin/login') {
      if (now() - windowStart >= 60000) { attempts = 0; windowStart = now(); }
      if (++attempts > 10) throw new ApiError(429, 'Too many sign-in attempts. Try again in a minute.');
      const { password } = await readBody();
      if (typeof password !== 'string' || password.length > 256 || !timingSafeEqual(digest(password), digest(env.ADMIN_PASSWORD))) throw new ApiError(401, 'Incorrect password.');
      const value = `${Math.floor(now() / 1000) + duration}:${randomBytes(16).toString('hex')}`;
      response.setHeader('Set-Cookie', cookie(`${value}.${signature(value)}`));
      return send(200, { ok: true });
    }
    if (!authenticated(request)) throw new ApiError(401, 'Sign in to continue.');
    if (request.method === 'GET' && request.url === '/api/admin/dashboard') {
      const value = env.POSTHOG_DASHBOARD_EMBED_URL;
      if (!value) return send(200, { embedUrl: '' });
      try {
        const url = new URL(value);
        const posthogHost = url.hostname === 'posthog.com' || url.hostname.endsWith('.posthog.com');
        if (url.protocol !== 'https:' || !posthogHost || url.username || url.password || url.port || !/^\/(shared|embedded)\/[^/]+\/?$/.test(url.pathname)) throw new Error('Invalid embed URL');
        url.pathname = url.pathname.replace(/^\/shared\//, '/embedded/');
        return send(200, { embedUrl: url.href });
      } catch { throw new ApiError(503, 'Set a valid PostHog shared or embedded dashboard URL in the backend environment.'); }
    }
    if (request.method === 'GET' && request.url === '/api/admin/lobbies') return send(200, { lobbies: await lobby.adminList() });
    if (request.method === 'POST' && request.url === '/api/admin/logout') {
      response.setHeader('Set-Cookie', cookie(''));
      return send(200, { ok: true });
    }
    if (request.method === 'POST' && request.url === '/api/admin/lobbies') return send(200, await lobby.manage(await readBody()));
    throw new ApiError(404, 'Not found');
  };
}

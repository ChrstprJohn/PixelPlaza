const CACHE_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;
const QUERY = `SELECT count() AS visits
FROM events
WHERE event = '$pageview'
  AND properties.site_name = 'pixelplaza'
  AND properties.environment = 'production'`;

// Only this fixed aggregate can be queried; credentials and raw events stay server-side.
export function createVisitsReader({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  let cached = { visits: null, expires: 0 };
  let pending;

  async function query() {
    const key = env.POSTHOG_PERSONAL_API_KEY;
    const projectId = env.POSTHOG_PROJECT_ID;
    if (!key || !/^\d+$/.test(projectId || '')) return null;
    try {
      const host = new URL(env.POSTHOG_API_HOST || 'https://us.posthog.com');
      if (host.protocol !== 'https:' || host.username || host.password || host.search || host.hash || host.pathname !== '/') return null;
      const response = await fetcher(`${host.origin}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query: QUERY } }),
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.error || !Array.isArray(data.results) || data.results.length !== 1 || !Array.isArray(data.results[0]) || data.results[0].length !== 1) return null;
      const value = data.results[0][0];
      if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
      const count = Number(value);
      return Number.isSafeInteger(count) && count >= 0 ? count : null;
    } catch { return null; }
  }

  return async function readVisits() {
    if (cached.expires <= now()) {
      pending ??= query().then(visits => {
        cached = { visits, expires: now() + (visits === null ? RETRY_MS : CACHE_MS) };
      }).finally(() => { pending = undefined; });
      await pending;
    }
    return cached.visits;
  };
}

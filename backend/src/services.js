const required = (env, name) => {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

function serviceUrl(env, name, privateRealtime = false) {
  const url = new URL(required(env, name));
  // HTTP stays inside Docker or the local end of an encrypted SSH tunnel.
  const privateHttp = privateRealtime && url.protocol === 'http:' && url.pathname === '/' &&
    (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      (url.hostname === 'realtime-server' && url.port === '3000'));
  if ((url.protocol !== 'https:' && !privateHttp) || url.username || url.password || url.search || url.hash) throw new Error(`Invalid ${name}`);
  return url.toString().replace(/\/$/, '');
}

export function createServices(env = process.env, fetcher = fetch) {
  const redisUrl = serviceUrl(env, 'UPSTASH_REDIS_REST_URL');
  const realtimeUrl = serviceUrl(env, 'REALTIME_API_URL', true);
  const redisToken = required(env, 'UPSTASH_REDIS_REST_TOKEN');
  const realtimeKey = required(env, 'REALTIME_API_KEY');
  const project = required(env, 'REALTIME_PROJECT_ID');
  if (project !== 'pixelplaza') throw new Error('Expected isolated pixelplaza credentials');
  async function request(url, token, payload) {
    const response = await fetcher(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    const data = await response.json();
    if (!response.ok || !data || data.error) throw new Error('Shared service request failed');
    return data;
  }
  return {
    async redis(command) {
      const result = await request(redisUrl, redisToken, command);
      if (!Object.hasOwn(result, 'result')) throw new Error('Invalid Redis response');
      return result.result;
    },
    async token(userId, channels) {
      if (!channels.every(channel => channel.startsWith('pixelplaza/'))) throw new Error('Channel outside PixelPlaza');
      const result = await request(realtimeUrl + '/token', realtimeKey, { userId, channels });
      if (typeof result.token !== 'string') throw new Error('Invalid realtime token');
      return result;
    },
    async publish(channel, data) {
      if (!channel.startsWith('pixelplaza/')) throw new Error('Channel outside PixelPlaza');
      const result = await request(realtimeUrl + '/publish', realtimeKey, { channel, data });
      if (result.success !== true) throw new Error('Invalid realtime publish reply');
      return result;
    },
  };
}

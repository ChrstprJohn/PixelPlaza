import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createVisitsReader } from '../src/visits.js';
import { createBackend } from '../src/server.js';

const env = { POSTHOG_PROJECT_ID: '643035', POSTHOG_PERSONAL_API_KEY: 'private-query-key' };
const response = results => ({ ok: true, json: async () => ({ results }) });

test('visits queries only PixelPlaza production pageviews, including a real zero', async () => {
  const read = createVisitsReader({ env, fetcher: async (url, options) => {
    assert.equal(url, 'https://us.posthog.com/api/projects/643035/query/');
    assert.equal(options.headers.Authorization, 'Bearer private-query-key');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    const { query } = JSON.parse(options.body);
    assert.equal(query.kind, 'HogQLQuery');
    assert.match(query.query, /SELECT count\(\) AS visits/);
    assert.match(query.query, /event = '\$pageview'/);
    assert.match(query.query, /site_name = 'pixelplaza'/);
    assert.match(query.query, /environment = 'production'/);
    assert.doesNotMatch(query.query, /DISTINCT|\$session_id/);
    return response([[0]]);
  } });
  assert.equal(await read(), 0);
  assert.equal(await createVisitsReader({ env, fetcher: async () => response([['1234']]) })(), 1234);
});

test('visits shares pending and cached queries for five minutes', async () => {
  let calls = 0, time = 1000;
  const read = createVisitsReader({ env, now: () => time, fetcher: async () => response([[++calls]]) });
  assert.deepEqual(await Promise.all([read(), read(), read()]), [1, 1, 1]);
  time += 299999;
  assert.equal(await read(), 1);
  assert.equal(calls, 1);
  time++;
  assert.equal(await read(), 2);
});

test('invalid visits settings do not send credentials to an invalid endpoint', async () => {
  for (const settings of [{}, { ...env, POSTHOG_PROJECT_ID: '../other' }, { POSTHOG_PROJECT_ID: '643035' }, ...['http://us.posthog.com', 'https://user:password@us.posthog.com', 'https://us.posthog.com/path', 'https://us.posthog.com?query=x'].map(POSTHOG_API_HOST => ({ ...env, POSTHOG_API_HOST }))]) {
    assert.equal(await createVisitsReader({ env: settings, fetcher: () => assert.fail('Must not fetch') })(), null);
  }
});

test('malformed counts and PostHog failures are unavailable, with a thirty-second backoff', async () => {
  for (const results of [[], [[null]], [[true]], [[-1]], [[1.5]], [['']], [['12x']], [[Number.MAX_SAFE_INTEGER + 1]], [[1, 2]], [[1], [2]], ['5']]) {
    assert.equal(await createVisitsReader({ env, fetcher: async () => response(results) })(), null);
  }
  let calls = 0, time = 1000;
  const read = createVisitsReader({ env, now: () => time, fetcher: async () => { if (++calls === 1) throw new Error('private upstream details'); return response([[7]]); } });
  assert.equal(await read(), null);
  time += 29999;
  assert.equal(await read(), null);
  assert.equal(calls, 1);
  time++;
  assert.equal(await read(), 7);
  assert.equal(await createVisitsReader({ env, fetcher: async () => ({ ok: false }) })(), null);
});

test('public visits endpoint returns only the aggregate and rejects writes and arbitrary queries', async t => {
  let count = 42, calls = 0;
  const server = createBackend({ readVisits: async () => { calls++; return count; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/visits`;
  const res = await fetch(url);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { visits: 42 });
  count = null;
  const unavailable = await fetch(url);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { visits: null });
  for (const method of ['POST', 'DELETE', 'PUT']) {
    const rejected = await fetch(url, { method, body: JSON.stringify({ query: 'SELECT * FROM persons' }) });
    assert.equal(rejected.status, 405);
    assert.equal(rejected.headers.get('allow'), 'GET');
  }
  assert.equal((await fetch(url + '?query=anything')).status, 404);
  assert.equal(calls, 2);
});

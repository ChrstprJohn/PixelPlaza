import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  .replace("import posthog from 'posthog-js';", '')
  .replaceAll('import.meta.env', 'env')
  .replaceAll('export ', '');

function fixture({ token = 'phc_test', path = '/', mode = 'production', broken = false } = {}) {
  const events = [];
  let config, optedOut = false;
  const posthog = {
    init(key, options) { if (broken) throw new Error('blocked'); config = options; options.loaded(this); },
    register(properties) { this.properties = properties; },
    has_opted_out_capturing() { return optedOut; },
    capture(event, properties) { events.push({ event, properties }); },
  };
  const context = vm.createContext({ posthog, env: { VITE_POSTHOG_TOKEN: token, MODE: mode }, window: { location: { pathname: path } } });
  vm.runInContext(source, context);
  return { events, config, posthog, track: context.trackEvent, optOut() { optedOut = true; } };
}

test('analytics tags initial/automatic/custom events and masks guest content', () => {
  const f = fixture();
  assert.equal(f.config.api_host, 'https://us.i.posthog.com');
  assert.equal(f.config.capture_pageview, 'history_change');
  assert.equal(f.config.mask_all_text, true);
  assert.equal(f.config.mask_all_element_attributes, true);
  assert.deepEqual(Array.from(f.config.autocapture.dom_event_allowlist), ['click']);
  assert.equal(f.config.autocapture.capture_copied_text, false);
  assert.equal(f.config.disable_session_recording, true);
  assert.equal(f.config.capture_exceptions, false);
  assert.equal(f.config.disable_surveys, true);
  assert.equal(f.config.cross_subdomain_cookie, false);
  assert.equal(f.config.person_profiles, 'identified_only');
  assert.equal(f.posthog.properties.site_name, 'pixelplaza');
  const automatic = f.config.before_send({ event: '$pageview', properties: { site_name: 'schedsnap' } });
  assert.equal(automatic.properties.site_name, 'pixelplaza');
  assert.equal(automatic.properties.environment, 'production');
  f.track('lobby_join_succeeded', { lobby_id: 'garden', site_name: 'signwise', environment: 'development' });
  assert.equal(f.events[0].properties.site_name, 'pixelplaza');
  assert.equal(f.events[0].properties.environment, 'production');
  assert.equal(f.events[0].properties.lobby_id, 'garden');
  assert.equal(f.config.before_send(null), null);
  f.optOut();
  f.track('chat_message_sent');
  assert.equal(f.events.length, 1);
});

test('unconfigured, blocked and admin visits do not capture events', () => {
  for (const settings of [{ token: '' }, { broken: true }, { path: '/admin' }, { path: '/admin/' }]) {
    const f = fixture(settings);
    f.track('plaza_screen_viewed', { screen: 'landing' });
    assert.equal(f.events.length, 0);
    assert.equal(f.config, undefined);
  }
  const dev = fixture({ mode: 'development' });
  dev.track('plaza_screen_viewed');
  assert.equal(dev.events[0].properties.environment, 'development');
});

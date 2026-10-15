import posthog from 'posthog-js';

const token = import.meta.env?.VITE_POSTHOG_TOKEN;
export const analyticsEnabled = Boolean(token);
const siteProperties = { site_name: 'pixelplaza', environment: import.meta.env?.MODE || 'development' };
let initialized = false;

// Admin pages contain player lists and sign-in controls; keep them out of analytics.
if (token && !/^\/admin(?:\/|$)/.test(window.location.pathname)) {
  try {
    posthog.init(token, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: 'history_change',
      person_profiles: 'identified_only',
      cross_subdomain_cookie: false,
      disable_session_recording: true,
      capture_exceptions: false,
      capture_performance: false,
      disable_surveys: true,
      rageclick: false,
      capture_dead_clicks: false,
      // Guest names and chat must never enter automatic interaction payloads.
      mask_all_text: true,
      mask_all_element_attributes: true,
      autocapture: { dom_event_allowlist: ['click'], capture_copied_text: false },
      loaded: client => client.register(siteProperties),
      before_send: event => {
        if (event) event.properties = { ...event.properties, ...siteProperties };
        return event;
      },
    });
    initialized = true;
  } catch { /* Analytics availability must not interrupt the plaza. */ }
}

export function trackEvent(event, properties = {}) {
  if (!initialized) return;
  try {
    if (!posthog.has_opted_out_capturing()) posthog.capture(event, { ...properties, ...siteProperties });
  } catch { /* Tracking is best effort in offline or restricted browsers. */ }
}

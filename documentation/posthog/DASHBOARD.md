# PixelPlaza dashboard

Open the [shared PostHog project](https://us.posthog.com/project/643035) and paste this into PostHog AI, or follow it manually. Create a separate dashboard; preserve the other apps' dashboards.

```text
Create a dashboard named "PixelPlaza" in this project.
Use ONLY events with event properties site_name = pixelplaza AND environment = production.
Apply both filters to every insight and the dashboard. Default to the last 30 days with daily intervals.

Create:
1. Total pageviews ($pageview) and unique visitors of $pageview as separate number tiles, plus daily trends.
2. Referral source, device, browser, and approximate country/city breakdowns using standard SDK properties. No GPS.
3. Screen usage: plaza_screen_viewed broken down by screen. React screen transitions do not produce new $pageview events.
4. Ordered 1-hour visitor funnel: plaza_screen_viewed (screen=landing) -> plaza_screen_viewed (screen=rooms) -> plaza_screen_viewed (screen=choose) -> lobby_join_started -> lobby_join_succeeded -> chat_message_sent. Label it a visitor funnel, not an exact per-session transaction funnel.
5. Daily total event counts for lobby_join_started, lobby_join_succeeded and lobby_join_failed; break successes down by lobby_id and character.
6. Join failures by lobby_id, error_type and http_status. Status 0 means unavailable, not HTTP success.
7. Chat engagement: chat_opened and chat_message_sent trends and breakdown by lobby_id. These events contain no message contents.
8. Explicit exits: lobby_left by lobby_id. This excludes tab closure, timeouts and removals; do not label it all departures or infer live player counts from it.

Use only actual event properties. If production events have not arrived, report missing events and leave supported insights empty rather than inventing data. State any manual setup needed for unsupported insights.
Do not enable session recordings, surveys, exception capture or location prompts. Never request names, chat text, guest IDs, credentials or movement data.
After creation, verify both site/environment filters and report the dashboard URL and missing production events.
```

Browser blockers and SDK opt-out can reduce recorded totals. Live player counts belong to the Lobbies admin tab. The public ingestion token cannot create dashboards or read reports; dashboard creation requires signed-in access or appropriate API scopes.

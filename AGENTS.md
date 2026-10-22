# Project rules

- Rewards are credited only server-side (SSV route or owner-only server functions calling SECURITY DEFINER SQL executable by service_role); never from the browser, so users can't grant themselves balance.
- SSV callbacks bind to the watcher via custom_data (= ad_view_requests.transaction_id) and user_id, decided by `resolveSsvBinding` in src/lib/ssv-binding.ts; AdMob's own transaction_id is stored as network_transaction_id for dedupe. Keep this single source so binding rules stay testable.
- The rewarded ad unit id lives in the `ad_settings` table (owner-editable), never in code, so it can change without a rebuild.
- Tests use vitest (`bunx vitest run`), next to the code they cover.

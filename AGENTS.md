# Raintree plugins agent instructions

- Treat product repositories and immutable release tags as canonical. Never
  hand-edit generated files under `plugins/`.
- Update `plugins.lock.json`, run `node scripts/sync-plugins.mjs`, and inspect the
  generated diff for every bundle change.
- Keep marketplace entries local, `AVAILABLE`, and `ON_INSTALL`. Do not add
  product gating or lifecycle hooks.
- Run `node scripts/validate.mjs`, `node scripts/sync-plugins.mjs --check`, and
  the plugin-creator validator for every generated plugin before release.
- Preserve entry order: DocPull, HIG Doctor, Raintree Standards, then Trellis.

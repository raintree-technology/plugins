# Contributing

Propose product behavior changes in the canonical product repository. A
marketplace update must point to an immutable release tag and full commit SHA.

Before opening a marketplace pull request, run:

```bash
node scripts/sync-plugins.mjs
node scripts/sync-plugins.mjs --check
node scripts/validate.mjs
```

Inspect the complete generated diff. Do not hand-edit `plugins/`.

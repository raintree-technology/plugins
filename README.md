# Raintree plugins

The official public Codex marketplace for Raintree Technology developer tools.
Every plugin bundle is generated from an immutable product release recorded in
`plugins.lock.json`. Product repositories remain canonical.

## Install

Add the marketplace and install Trellis:

```bash
codex plugin marketplace add raintree-technology/plugins
codex plugin add trellis@raintree
```

Stable marketplace commands:

```text
codex plugin marketplace add raintree-technology/plugins
codex plugin marketplace upgrade raintree
codex plugin add <plugin>@raintree
codex plugin remove <plugin>@raintree
```

DocPull 6.5.0 was removed from the current marketplace after a clean-install
test found that its open MCP dependency range resolves to an incompatible major
version. The immutable `v0.1.0` tag remains the audit record. DocPull will return
after a corrected product release passes the same fresh-task test.

## Reproduce the bundles

Run `node scripts/sync-plugins.mjs` to reconstruct `plugins/` from the locked
tags. Run `node scripts/sync-plugins.mjs --check` to generate into a temporary
directory and fail when the committed bundles drift.

The synchronizer rejects mutable refs, shortened commit SHAs, missing product
licenses, selected paths that escape a source repository, escaping symlinks,
missing source paths, manifest name or version mismatches, and undeclared files
in committed bundles.

## Evidence boundary

Plugin installation does not certify a project, interface, source corpus, or
standards decision. Each product owns its behavior, limits, and release notes.

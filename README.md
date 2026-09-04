# Raintree plugins

The official public Codex marketplace for Raintree Technology developer tools.
Every plugin bundle is generated from an immutable product release recorded in
`plugins.lock.json`. Product repositories remain canonical.

## Install

DocPull requires its local MCP runtime:

```bash
pipx install 'docpull[mcp]==6.5.0'
```

Then add the marketplace and install a plugin:

```bash
codex plugin marketplace add raintree-technology/plugins
codex plugin add docpull@raintree
codex plugin add hig-doctor@raintree
```

Stable marketplace commands:

```text
codex plugin marketplace add raintree-technology/plugins
codex plugin marketplace upgrade raintree
codex plugin add <plugin>@raintree
codex plugin remove <plugin>@raintree
```

If the DocPull plugin reports that the `docpull` executable is missing, run the
pinned `pipx` command above, verify `docpull --version`, and restart Codex.

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

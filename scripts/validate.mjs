#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const marketplace = JSON.parse(readFileSync(resolve(root, ".agents/plugins/marketplace.json"), "utf8"));
const lock = JSON.parse(readFileSync(resolve(root, "plugins.lock.json"), "utf8"));
const failures = [];

if (marketplace.name !== "raintree") failures.push("marketplace name must be raintree");
if (marketplace.interface?.displayName !== "Raintree Technology") failures.push("marketplace display name is invalid");
if (lock.schemaVersion !== 1) failures.push("lock schemaVersion must be 1");

const lockByName = new Map(lock.plugins.map((plugin) => [plugin.name, plugin]));
for (const entry of marketplace.plugins) {
  if (entry.source?.source !== "local" || entry.source?.path !== `./plugins/${entry.name}`) failures.push(`${entry.name}: source must be its local bundle`);
  if (entry.policy?.installation !== "AVAILABLE") failures.push(`${entry.name}: installation must be AVAILABLE`);
  if (entry.policy?.authentication !== "ON_INSTALL") failures.push(`${entry.name}: authentication must be ON_INSTALL`);
  if ("products" in (entry.policy ?? {})) failures.push(`${entry.name}: product gating is not allowed`);
  const manifestPath = resolve(root, "plugins", entry.name, ".codex-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    failures.push(`${entry.name}: manifest is missing`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const locked = lockByName.get(entry.name);
  if (!locked || manifest.version !== locked.version) failures.push(`${entry.name}: manifest and lock versions differ`);
  if (manifest.hooks) failures.push(`${entry.name}: lifecycle hooks are not allowed`);
}

const marketplaceNames = marketplace.plugins.map((entry) => entry.name);
const lockNames = lock.plugins.map((entry) => entry.name);
if (JSON.stringify(marketplaceNames) !== JSON.stringify(lockNames)) failures.push("marketplace and lock order differ");

if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Marketplace valid: ${marketplace.plugins.length} plugins\n`);
}

#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const immutableTag = /^(?:[a-z0-9-]+-)?v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const fullSha = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(message);
}

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${command} ${arguments_.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function inside(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !isAbsolute(pathFromRoot));
}

function validateEntry(entry, names) {
  const required = ["name", "repository", "ref", "commit", "sourcePaths", "version"];
  for (const field of required) if (!(field in entry)) fail(`${entry.name ?? "plugin"}: missing ${field}`);
  if (names.has(entry.name)) fail(`duplicate plugin name ${entry.name}`);
  names.add(entry.name);
  if (!immutableTag.test(entry.ref)) fail(`${entry.name}: ref ${entry.ref} is not an immutable semantic-version tag`);
  if (!fullSha.test(entry.commit)) fail(`${entry.name}: commit must be a full lowercase SHA`);
  if (!entry.repository.startsWith("https://github.com/")) fail(`${entry.name}: repository must use GitHub HTTPS`);
  if (!Array.isArray(entry.sourcePaths) || entry.sourcePaths.length === 0) fail(`${entry.name}: sourcePaths must be non-empty`);
  for (const sourcePath of entry.sourcePaths) {
    if (typeof sourcePath !== "string" || sourcePath === "" || isAbsolute(sourcePath) || sourcePath.split(/[\\/]/).includes("..")) {
      fail(`${entry.name}: invalid source path ${JSON.stringify(sourcePath)}`);
    }
  }
}

function inspectSymlinks(sourceRoot, selectedPath, pluginName) {
  const pending = [selectedPath];
  while (pending.length > 0) {
    const path = pending.pop();
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      const target = realpathSync(path);
      if (!inside(sourceRoot, target)) fail(`${pluginName}: symlink escapes source root: ${relative(sourceRoot, path)}`);
      continue;
    }
    if (stat.isDirectory()) {
      for (const child of readdirSync(path)) pending.push(join(path, child));
    }
  }
}

function copySelection(sourceRoot, bundleRoot, sourcePath, pluginName) {
  const source = resolve(sourceRoot, sourcePath);
  if (!inside(sourceRoot, source)) fail(`${pluginName}: source path escapes repository: ${sourcePath}`);
  if (!existsSync(source)) fail(`${pluginName}: missing selected source path ${sourcePath}`);
  inspectSymlinks(sourceRoot, source, pluginName);

  if (sourcePath.replace(/[\\/]$/, "") === "plugin" && statSync(source).isDirectory()) {
    for (const child of readdirSync(source).sort()) {
      cpSync(join(source, child), join(bundleRoot, child), { recursive: true, dereference: true, preserveTimestamps: false });
    }
    return;
  }
  cpSync(source, join(bundleRoot, sourcePath), { recursive: true, dereference: true, preserveTimestamps: false });
}

function files(root) {
  if (!existsSync(root)) return [];
  const found = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const rel = relative(root, path);
      const stat = lstatSync(path);
      if (stat.isDirectory()) walk(path);
      else found.push(rel);
    }
  };
  walk(root);
  return found;
}

function compareTrees(expected, actual) {
  const expectedFiles = files(expected);
  const actualFiles = files(actual);
  const undeclared = actualFiles.filter((path) => !expectedFiles.includes(path));
  const missing = expectedFiles.filter((path) => !actualFiles.includes(path));
  const changed = expectedFiles.filter(
    (path) => actualFiles.includes(path) && !readFileSync(join(expected, path)).equals(readFileSync(join(actual, path))),
  );
  if (undeclared.length || missing.length || changed.length) {
    fail(`generated bundle drift:\n  undeclared: ${undeclared.join(", ") || "none"}\n  missing: ${missing.join(", ") || "none"}\n  changed: ${changed.join(", ") || "none"}`);
  }
}

function generate(outputRoot, lock) {
  const names = new Set();
  mkdirSync(outputRoot, { recursive: true });
  for (const entry of lock.plugins) {
    validateEntry(entry, names);
    const checkoutParent = mkdtempSync(join(tmpdir(), `raintree-${entry.name}-`));
    const sourceRoot = join(checkoutParent, "source");
    try {
      mkdirSync(sourceRoot);
      run("git", ["init", "--quiet"], sourceRoot);
      run("git", ["remote", "add", "origin", entry.repository], sourceRoot);
      run("git", ["fetch", "--quiet", "--depth=1", "origin", `refs/tags/${entry.ref}`], sourceRoot);
      run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], sourceRoot);
      const actualCommit = run("git", ["rev-parse", "HEAD"], sourceRoot);
      if (actualCommit !== entry.commit) fail(`${entry.name}: tag resolves to ${actualCommit}, expected ${entry.commit}`);
      if (!["LICENSE", "LICENSE.md"].some((name) => existsSync(join(sourceRoot, name)))) fail(`${entry.name}: source release has no license file`);

      const bundleRoot = join(outputRoot, entry.name);
      mkdirSync(bundleRoot, { recursive: true });
      for (const sourcePath of entry.sourcePaths) copySelection(sourceRoot, bundleRoot, sourcePath, entry.name);

      const manifestPath = join(bundleRoot, ".codex-plugin", "plugin.json");
      if (!existsSync(manifestPath)) fail(`${entry.name}: generated bundle has no plugin manifest`);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.name !== entry.name && manifest.id !== entry.name) fail(`${entry.name}: manifest name does not match lock`);
      if (manifest.version !== entry.version) fail(`${entry.name}: manifest version ${manifest.version} does not match ${entry.version}`);
      if (!manifest.license) fail(`${entry.name}: manifest does not declare a license`);
    } finally {
      rmSync(checkoutParent, { recursive: true, force: true });
    }
  }
}

function main() {
  const arguments_ = process.argv.slice(2);
  const check = arguments_.includes("--check");
  if (arguments_.some((argument) => argument !== "--check")) fail(`unknown argument ${arguments_.find((argument) => argument !== "--check")}`);
  const lock = JSON.parse(readFileSync(join(repositoryRoot, "plugins.lock.json"), "utf8"));
  if (lock.schemaVersion !== 1 || !Array.isArray(lock.plugins)) fail("plugins.lock.json must use schemaVersion 1 and a plugins array");

  const temporaryRoot = mkdtempSync(join(tmpdir(), "raintree-plugins-"));
  const generated = join(temporaryRoot, "plugins");
  try {
    generate(generated, lock);
    const committed = join(repositoryRoot, "plugins");
    if (check) compareTrees(generated, committed);
    else {
      rmSync(committed, { recursive: true, force: true });
      cpSync(generated, committed, { recursive: true, preserveTimestamps: false });
    }
    process.stdout.write(`${check ? "Verified" : "Generated"} ${lock.plugins.length} plugin bundles.\n`);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

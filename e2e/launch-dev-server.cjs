#!/usr/bin/env node
/**
 * Playwright web-server launcher.
 *
 * Playwright starts *this* process, not Next.js directly. That indirection is
 * the whole point: Playwright hands its child `{ ...process.env,
 * ...webServer.env }`, so this process inevitably inherits the parent shell.
 * It is allowed to -- it reads that environment only to validate `SUPABASE_URL`.
 * It then spawns Next.js with a freshly constructed allowlisted environment and
 * nothing else, so none of the parent's secrets reach the server or any of its
 * descendants.
 *
 * Exits non-zero before any server exists if the URL is remote or a Next.js
 * env file would re-inject credentials from disk.
 */

"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS entry point; `node` must load it without a transform. */
const { launchDevServer } = require("./isolation-core.cjs");

const result = launchDevServer();

if (!result.ok) {
  process.exit(result.exitCode);
}

const { child } = result;

// If Playwright kills this process (`taskkill /T /F` on Windows, SIGTERM
// elsewhere), take the server down with us instead of orphaning it.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  try {
    process.once(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  } catch {
    // SIGHUP is not supported on Windows; ignore and rely on taskkill /T.
  }
}

child.once("error", (error) => {
  console.error(`[e2e] failed to start the dev server: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

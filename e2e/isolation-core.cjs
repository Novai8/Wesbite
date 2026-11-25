/**
 * Fail-closed Supabase/Playwright isolation: the shared implementation.
 *
 * CommonJS on purpose. Three consumers load this module in contexts that
 * cannot rely on a TypeScript or ESM transform:
 *
 *  - `playwright.config.ts` is evaluated by Playwright's own babel loader,
 *    which rewrites `import.meta` and breaks genuine ESM.
 *  - `e2e/launch-dev-server.cjs` runs under bare `node` before Next exists.
 *  - `tests/e2e-isolation.test.ts` uses `createRequire` to assert on the exact
 *    object the launcher spawns with.
 *
 * `e2e/supabase-isolation.ts` re-exports this module and adds the TS surface.
 *
 * Why isolation needs a launcher at all: Playwright builds the web-server
 * environment as `{ ...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env,
 * ...webServer.env }`. `webServer.env` is *merged over* the parent, never
 * substituted for it, so a config-level object cannot remove a variable an
 * operator's shell exported -- the defect independent QA found. Only a process
 * that calls `spawn()` itself can hand a child a replaced environment. That is
 * `spawnDevServer` below.
 */

"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS by design: Playwright's babel loader rewrites `import.meta` and cannot load genuine ESM configs. */
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

/**
 * Repository root, derived from this file's location -- never from
 * `process.cwd()`. Playwright may be invoked from any directory, and the
 * env-file guard must inspect the directory `next dev` will actually use.
 */
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Dedicated E2E binding.
 *
 * 3100 is the ordinary dev port and is routinely occupied by other worktrees;
 * `reuseExistingServer: false` turns a collision into a hard failure rather
 * than a silent attach to somebody else's server. Bound to loopback so the
 * test server is never reachable off-host.
 */
const E2E_HOST = "127.0.0.1";
const E2E_PORT = 3101;
const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;

/** Hostnames that cannot leave the machine. */
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * The only variables the Next.js E2E server and its descendants may receive.
 *
 * Chosen by inspection of what `next dev` needs: `PATH`/`PATHEXT` to resolve
 * binaries, `SystemRoot`/`WINDIR`/`COMSPEC` for Windows process creation,
 * `TEMP`/`TMP` for scratch files, the user-profile variables Node and npm
 * read, and locale/terminal variables on POSIX CI.
 *
 * `NODE_ENV` and the Supabase URL variables are deliberately absent: they are
 * set explicitly by `e2eServerEnv`. Every application credential is excluded
 * by omission, which is the point -- an allowlist cannot forget a secret added
 * to the app tomorrow.
 */
const ALLOWED_VARIABLES = [
  // Process resolution and shell plumbing.
  "PATH",
  "PATHEXT",
  "COMSPEC",
  "SystemRoot",
  "SystemDrive",
  "WINDIR",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "COMMONPROGRAMFILES",
  "PROGRAMDATA",
  // Scratch directories.
  "TEMP",
  "TMP",
  "TMPDIR",
  // User profile / caches that npm and Node read.
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "USER",
  "LOGNAME",
  // POSIX terminal/locale, needed by the ubuntu CI runner.
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
];

/**
 * Variables that must never reach the child from the parent shell. Listed so
 * the intent is testable and greppable rather than implicit in the allowlist.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is deliberately *not* here: it is derived from
 * the validated loopback URL (or "" when unconfigured) and set explicitly, so
 * it can never carry a parent value.
 */
const FORBIDDEN_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_PROJECT_REF",
  "DATABASE_URL",
  "DIRECT_URL",
  "N8N_WEBHOOK_SECRET",
  "N8N_API_KEY",
  "HF_TOKEN",
  "HUGGINGFACE_TOKEN",
  "GROQ_API_KEY",
  "FREELLMAPI_API_KEY",
  "FREELLMAPI_BASE_URL",
  "FYNDRA_3D_WORKER_SECRET",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_ACCESS_TOKEN",
  "ADMITAD_WEBSITE_ID",
  "ADMITAD_FEED_URL",
];

/**
 * Env files Next.js would load for this command.
 *
 * `next dev` runs with `NODE_ENV=development`, so it reads
 * `.env.development.local`, `.env.local`, `.env.development`, then `.env`.
 * `.env.test*` is included because a test-mode run would read those instead.
 * `.env.example` (template) and `.env.staging.local` (not a name Next loads)
 * are deliberately absent: neither is read by Next.
 */
const BLOCKED_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
];

/**
 * Validates the value the E2E server may receive as `SUPABASE_URL`.
 *
 * - `undefined` / empty  -> not configured, allowed (seed-only catalogue).
 * - loopback http(s)     -> allowed, returned in normalized form.
 * - any other host       -> rejected, including Supabase project URLs.
 * - malformed            -> rejected.
 *
 * @param {string | undefined} raw
 * @returns {{ ok: true, normalized: string } | { ok: false, message: string }}
 */
function checkSupabaseUrl(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: true, normalized: "" };
  }

  // Count `://` rather than relying on `new URL`, which happily accepts some
  // surprising inputs. Two schemes means a spliced URL, not a base URL.
  const schemeSeparators = value.match(/:\/\//g)?.length ?? 0;
  if (schemeSeparators !== 1) {
    return {
      ok: false,
      message:
        "SUPABASE_URL is malformed: expected exactly one scheme (http:// or https://)",
    };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      message: "SUPABASE_URL is malformed: not a parseable absolute URL",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      message: "SUPABASE_URL is malformed: only http:// and https:// are accepted",
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      message:
        "SUPABASE_URL is malformed: credentials must not be embedded in the URL",
    };
  }

  const hostname = url.hostname.toLowerCase();
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    return {
      ok: false,
      message:
        `SUPABASE_URL points at a remote host (${hostname}); the E2E suite may only ` +
        "use an explicit loopback destination such as http://127.0.0.1:<port>. " +
        "Unset it, or start a local Supabase stack, rather than pointing tests at a project.",
    };
  }

  return {
    ok: true,
    normalized: `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}`,
  };
}

/**
 * Refuses to start when an env file Next would load exists.
 *
 * The error names the file and never its contents: a path is not a secret, and
 * an operator needs to know which file to move out of the way.
 *
 * Defaults to `PROJECT_ROOT` -- the directory `next dev` reads -- not
 * `process.cwd()`, which is whatever directory the operator happened to be in.
 *
 * @param {string} [dir]
 * @returns {string | null}
 */
function findBlockingEnvFile(dir = PROJECT_ROOT) {
  for (const name of BLOCKED_ENV_FILES) {
    if (existsSync(path.join(dir, name))) return name;
  }
  return null;
}

/**
 * @param {string} [dir]
 * @returns {void}
 */
function assertNoEnvFiles(dir = PROJECT_ROOT) {
  const blocking = findBlockingEnvFile(dir);
  if (blocking) {
    throw new Error(
      `[e2e] refusing to start: ${blocking} exists in ${dir}. ` +
        "Next.js would load it into the E2E server and re-introduce credentials " +
        "after the environment scrub. Move or rename it before running the suite.",
    );
  }
}

/**
 * Environment for the Next.js E2E server.
 *
 * Built from scratch: only allowlisted process plumbing is copied, `NODE_ENV`
 * is pinned, and both Supabase URL variables are set to the validated loopback
 * value -- or to `""` when Supabase is unconfigured, so a parent value can
 * never survive under either name.
 *
 * `rawUrl` is required on purpose. A default of `process.env.SUPABASE_URL` let
 * an explicit `undefined` silently re-read the ambient shell, which is exactly
 * the leak this guard exists to prevent. Callers now pass the value they mean,
 * including `undefined` for "unconfigured".
 *
 * @param {Record<string, string | undefined>} base
 * @param {string | undefined} rawUrl
 * @returns {Record<string, string>}
 */
function e2eServerEnv(base, rawUrl) {
  const check = checkSupabaseUrl(rawUrl);
  if (!check.ok) {
    throw new Error(check.message);
  }

  /** @type {Record<string, string>} */
  const env = {};
  for (const name of ALLOWED_VARIABLES) {
    const value = base?.[name];
    if (typeof value === "string" && value) env[name] = value;
  }

  // `next dev` expects development. Setting it explicitly means Next does not
  // infer a mode, and makes the .env.development* files the relevant ones.
  env.NODE_ENV = "development";
  // Next phones home with anonymous usage data unless told otherwise. Pinned
  // here (never inherited) so the E2E run cannot make an outbound request.
  env.NEXT_TELEMETRY_DISABLED = "1";

  // Both variables always present and always identical: either the validated
  // loopback URL or "". Nothing from the parent survives under these names.
  env.SUPABASE_URL = check.normalized;
  env.NEXT_PUBLIC_SUPABASE_URL = check.normalized;

  return env;
}

/**
 * Absolute path to the Next.js CLI entry point shipped with this repo.
 *
 * @param {string} [root]
 * @returns {string}
 */
function nextCliPath(root = PROJECT_ROOT) {
  return path.join(root, "node_modules", "next", "dist", "bin", "next");
}

/**
 * Argument vector for `next dev`, bound to loopback on the dedicated port.
 *
 * @param {{ port?: number, host?: string }} [options]
 * @returns {string[]}
 */
function devServerArgs({ port = E2E_PORT, host = E2E_HOST } = {}) {
  return ["dev", "--port", String(port), "--hostname", host];
}

/**
 * Spawns a Node script with a *replaced* environment.
 *
 * `env` is handed to `spawn` as-is. There is no `{ ...process.env }` anywhere
 * on this path, so the child and all of its descendants see only the
 * allowlist. `nodePath` is spawned directly (no shell), so no shell profile,
 * `NODE_OPTIONS`, or quoting rule can reintroduce parent state.
 *
 * @param {{
 *   env: Record<string, string>,
 *   cwd?: string,
 *   nodePath?: string,
 *   scriptPath?: string,
 *   args?: string[],
 *   stdio?: import("node:child_process").StdioOptions,
 * }} options
 * @returns {import("node:child_process").ChildProcess}
 */
function spawnDevServer({
  env,
  cwd = PROJECT_ROOT,
  nodePath = process.execPath,
  scriptPath = nextCliPath(cwd),
  args = devServerArgs(),
  stdio = "inherit",
}) {
  return spawn(nodePath, [scriptPath, ...args], {
    cwd,
    env,
    stdio,
    windowsHide: true,
    shell: false,
  });
}

/**
 * Launcher body used by `e2e/launch-dev-server.cjs` and asserted directly by
 * the regression tests.
 *
 * Order matters: validate the URL, refuse blocked env files, build the child
 * environment, then start Next.js. Any failure exits before a server exists.
 *
 * @param {{
 *   base?: Record<string, string | undefined>,
 *   root?: string,
 *   log?: (message: string) => void,
 * }} [options]
 * @returns {{ ok: false, exitCode: number } | { ok: true, child: import("node:child_process").ChildProcess, env: Record<string, string>, host: string, port: number }}
 */
function launchDevServer({
  base = process.env,
  root = PROJECT_ROOT,
  log = console.error,
} = {}) {
  const check = checkSupabaseUrl(base?.SUPABASE_URL);
  if (!check.ok) {
    log(`[e2e] refusing to start: ${check.message}`);
    return { ok: false, exitCode: 1 };
  }

  const blocking = findBlockingEnvFile(root);
  if (blocking) {
    log(
      `[e2e] refusing to start: ${blocking} exists in ${root}. ` +
        "Next.js would load it into the E2E server and re-introduce credentials " +
        "after the environment scrub. Move or rename it before running the suite.",
    );
    return { ok: false, exitCode: 1 };
  }

  const env = e2eServerEnv(base, base?.SUPABASE_URL);
  const child = spawnDevServer({
    env,
    cwd: root,
    scriptPath: nextCliPath(root),
    args: devServerArgs(),
  });

  return { ok: true, child, env, host: E2E_HOST, port: E2E_PORT };
}

module.exports = {
  ALLOWED_VARIABLES,
  BLOCKED_ENV_FILES,
  E2E_BASE_URL,
  E2E_HOST,
  E2E_PORT,
  FORBIDDEN_VARIABLES,
  PROJECT_ROOT,
  assertNoEnvFiles,
  checkSupabaseUrl,
  devServerArgs,
  e2eServerEnv,
  findBlockingEnvFile,
  launchDevServer,
  nextCliPath,
  spawnDevServer,
};

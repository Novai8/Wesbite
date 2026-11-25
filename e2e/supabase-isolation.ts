/**
 * Fail-closed Supabase isolation for the Playwright suite: typed facade.
 *
 * The implementation lives in `e2e/isolation-core.cjs` because three consumers
 * cannot load TypeScript:
 *
 *  - `playwright.config.ts` is evaluated by Playwright's own babel loader,
 *    which rewrites `import.meta` and therefore breaks genuine ESM.
 *  - `e2e/launch-dev-server.cjs` runs under bare `node` before Next exists.
 *  - the regression tests `require()` it to assert on the spawned env.
 *
 * Everything here is a thin, type-checked pass-through so the app's tests
 * (which run through the alias loader) get real types while the runtime code
 * stays in one place.
 *
 * The isolation boundary is the launcher, not `webServer.env`: Playwright
 * merges its web-server env over the parent environment, so only a process
 * that calls `spawn()` with a replacement env can hide a shell-exported
 * secret. See `isolation-core.cjs` for the full rationale.
 */

import {
  ALLOWED_VARIABLES as ALLOWED_VARIABLES_CORE,
  BLOCKED_ENV_FILES as BLOCKED_ENV_FILES_CORE,
  E2E_BASE_URL as E2E_BASE_URL_CORE,
  E2E_HOST as E2E_HOST_CORE,
  E2E_PORT as E2E_PORT_CORE,
  FORBIDDEN_VARIABLES as FORBIDDEN_VARIABLES_CORE,
  PROJECT_ROOT as PROJECT_ROOT_CORE,
  assertNoEnvFiles as assertNoEnvFilesCore,
  checkSupabaseUrl as checkSupabaseUrlCore,
  devServerArgs as devServerArgsCore,
  e2eServerEnv as e2eServerEnvCore,
  findBlockingEnvFile as findBlockingEnvFileCore,
  launchDevServer as launchDevServerCore,
  nextCliPath as nextCliPathCore,
  spawnDevServer as spawnDevServerCore,
} from "./isolation-core.cjs";

/** Repository root resolved from the module location, never `process.cwd()`. */
export const PROJECT_ROOT: string = PROJECT_ROOT_CORE;

/** Dedicated loopback E2E binding. */
export const E2E_HOST: string = E2E_HOST_CORE;
export const E2E_PORT: number = E2E_PORT_CORE;
export const E2E_BASE_URL: string = E2E_BASE_URL_CORE;

/** Variables the E2E server and its children may receive from the parent. */
export const ALLOWED_VARIABLES: readonly string[] = ALLOWED_VARIABLES_CORE;

/** Variables that must never reach the E2E server from the parent shell. */
export const FORBIDDEN_VARIABLES: readonly string[] = FORBIDDEN_VARIABLES_CORE;

/** Env files Next.js would load for this command. */
export const BLOCKED_ENV_FILES: readonly string[] = BLOCKED_ENV_FILES_CORE;

/** Parent environment shape: `process.env` plus plain objects in tests. */
export type EnvSource = Record<string, string | undefined>;

/** The child environment handed to `spawn`. */
export type E2eServerEnv = Record<string, string>;

export type SupabaseUrlCheck =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

export function checkSupabaseUrl(raw: string | undefined): SupabaseUrlCheck {
  return checkSupabaseUrlCore(raw) as SupabaseUrlCheck;
}

/**
 * Environment for the Next.js E2E server.
 *
 * `rawUrl` is required: passing `undefined` means "Supabase not configured"
 * and must not fall back to reading `process.env.SUPABASE_URL`.
 */
export function e2eServerEnv(
  base: EnvSource,
  rawUrl: string | undefined,
): E2eServerEnv {
  return e2eServerEnvCore(base, rawUrl) as E2eServerEnv;
}

export function findBlockingEnvFile(dir: string = PROJECT_ROOT): string | null {
  return findBlockingEnvFileCore(dir) as string | null;
}

export function assertNoEnvFiles(dir: string = PROJECT_ROOT): void {
  assertNoEnvFilesCore(dir);
}

export function nextCliPath(root: string = PROJECT_ROOT): string {
  return nextCliPathCore(root) as string;
}

export function devServerArgs(
  options?: { port?: number; host?: string },
): string[] {
  return devServerArgsCore(options) as string[];
}

/**
 * Spawns the Next.js E2E server with a replaced environment.
 *
 * Exposed for the regression tests so they can assert on the real `spawn`
 * call rather than a mock. The launcher (`e2e/launch-dev-server.cjs`) is the
 * production entry point.
 */
export function spawnDevServer(options: {
  env: E2eServerEnv;
  cwd?: string;
  scriptPath?: string;
  args?: string[];
  stdio?: import("node:child_process").StdioOptions;
}): import("node:child_process").ChildProcess {
  return spawnDevServerCore(options) as import("node:child_process").ChildProcess;
}

/**
 * Launcher body: validate, refuse env files, build the env, spawn Next.js.
 *
 * Returns `{ ok: false }` instead of throwing so the CLI wrapper can exit
 * cleanly with a non-zero status.
 */
export function launchDevServer(options?: {
  base?: EnvSource;
  root?: string;
  log?: (message: string) => void;
}): ReturnType<typeof launchDevServerCore> {
  return launchDevServerCore(options) as ReturnType<typeof launchDevServerCore>;
}

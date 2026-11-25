import { defineConfig, devices } from "@playwright/test";
import {
  E2E_BASE_URL,
  assertNoEnvFiles,
  checkSupabaseUrl,
} from "./e2e/supabase-isolation";

/**
 * Fail closed before any server or test starts.
 *
 * Two independent checks, both here so a misconfiguration aborts the whole run:
 * a remote `SUPABASE_URL` is refused outright, and so is any `next dev` env
 * file that would re-inject credentials from disk. There is deliberately no
 * fallback that quietly rewrites the URL and carries on.
 */
const supabaseCheck = checkSupabaseUrl(process.env.SUPABASE_URL);
if (!supabaseCheck.ok) {
  throw new Error(`[e2e] refusing to start: ${supabaseCheck.message}`);
}
assertNoEnvFiles();

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command: `node e2e/launch-dev-server.cjs`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    // Do NOT set `env` here expecting it to isolate the server: Playwright
    // builds the child environment as `{ ...DEFAULT_ENVIRONMENT_VARIABLES,
    // ...process.env, ...webServer.env }`, i.e. this object is merged *over*
    // the parent shell, never substituted for it. A shell-exported
    // `SUPABASE_SERVICE_ROLE_KEY` therefore still reaches the command below.
    //
    // The real boundary is the launcher: `e2e/launch-dev-server.cjs` spawns
    // Next.js itself, passing an environment rebuilt from the allowlist in
    // `e2e/isolation-core.cjs` and nothing else. The launcher inheriting the
    // parent is expected and harmless -- it only reads `SUPABASE_URL` to
    // validate it, then drops everything.
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
});

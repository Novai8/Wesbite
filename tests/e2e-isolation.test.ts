import assert from "node:assert/strict";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
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
  nextCliPath,
  spawnDevServer,
} from "../e2e/supabase-isolation.ts";

/**
 * E2E isolation guard.
 *
 * The independent QA found that Playwright merges `webServer.env` *over* the
 * parent environment, so a config-level allowlist never removed a
 * shell-exported secret. The fix moved the boundary into a launcher that
 * spawns Next.js itself. These tests therefore assert two separate things:
 *
 *  1. `e2eServerEnv` builds a correct object from a source environment.
 *  2. A *really spawned* child receives that object and nothing else -- the
 *     only assertion that would have caught the original bug.
 *
 * Synthetic canary values only; no real credential is read or compared.
 */

const CANARY = "canary-value-must-not-pass";

function baseEnv(): Record<string, string> {
  return {
    PATH: "C:/Windows/System32",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    SystemRoot: "C:/Windows",
    SystemDrive: "C:",
    WINDIR: "C:/Windows",
    TEMP: "C:/Temp",
    TMP: "C:/Temp",
    USERPROFILE: "C:/Users/tester",
    APPDATA: "C:/Users/tester/AppData/Roaming",
    LOCALAPPDATA: "C:/Users/tester/AppData/Local",
    HOMEDRIVE: "C:",
    HOMEPATH: "\\Users\\tester",
    COMSPEC: "C:/Windows/system32/cmd.exe",
    NUMBER_OF_PROCESSORS: "8",
    PROCESSOR_ARCHITECTURE: "AMD64",
    OS: "Windows_NT",
  };
}

/** Every secret-ish variable the app or a CI shell might export. */
function secretEnv(): Record<string, string> {
  const env: Record<string, string> = { CANARY_SECRET: CANARY };
  for (const name of FORBIDDEN_VARIABLES) env[name] = CANARY;
  return env;
}

/**
 * Spawns a throwaway probe through the real `spawn` path and returns the
 * environment the child actually observed.
 */
async function envSeenBySpawnedChild(
  source: Record<string, string | undefined>,
  rawUrl: string | undefined,
): Promise<Record<string, string>> {
  const { spawn } = await import("node:child_process");
  const buildEnv = e2eServerEnv;

  const dir = mkdtempSync(path.join(tmpdir(), "fyndra-spawn-"));
  try {
    const env = buildEnv(source, rawUrl);
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["-e", "process.stdout.write(JSON.stringify(process.env))"],
        {
          cwd: dir,
          env: env as NodeJS.ProcessEnv,
          stdio: "pipe",
          shell: false,
          windowsHide: true,
        },
      ) as ChildProcessWithoutNullStreams;
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += String(chunk)));
      child.stderr.on("data", (chunk: Buffer) => (stderr += String(chunk)));
      child.once("error", reject);
      child.once("close", (code: number | null) => {
        if (code !== 0) reject(new Error(`probe exited ${code}: ${stderr}`));
        else resolve(stdout);
      });
    });
    return JSON.parse(output) as Record<string, string>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("loopback http and https destinations are accepted", () => {
  for (const url of [
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
    "https://127.0.0.1",
  ]) {
    assert.equal(checkSupabaseUrl(url).ok, true, `${url} should be accepted`);
  }
});

test("accepted URL is normalised and keeps its loopback port", () => {
  const result = checkSupabaseUrl("http://127.0.0.1:54321/some/path");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.normalized, "http://127.0.0.1:54321");
});

test("remote Supabase project URLs are rejected", () => {
  for (const url of [
    "https://zbogqfmbephhskcdfskr.supabase.co",
    "https://example.supabase.co/rest/v1",
    "http://10.0.0.5:54321",
  ]) {
    const result = checkSupabaseUrl(url);
    assert.equal(result.ok, false, `${url} must be rejected`);
    if (!result.ok) assert.match(result.message, /remote host/i);
  }
});

test("loopback look-alike hosts are rejected", () => {
  for (const url of [
    "http://127.0.0.1.evil.example:54321",
    "http://localhost.evil.example",
    "http://0.0.0.0:54321",
    "http://[::ffff:127.0.0.1]:54321",
    "http://[::ffff:8.8.8.8]:54321",
  ]) {
    assert.equal(checkSupabaseUrl(url).ok, false, `${url} must be rejected`);
  }
});

test("malformed values are rejected", () => {
  for (const url of [
    "not a url",
    "127.0.0.1:54321",
    "ftp://127.0.0.1",
    "ws://127.0.0.1",
    "file:///etc/passwd",
    "http://",
    "http://127.0.0.1://evil.example",
    "http://user:pass@127.0.0.1:54321",
    "//evil.example",
  ]) {
    assert.equal(checkSupabaseUrl(url).ok, false, `${url} must be rejected`);
  }
});

test("missing configuration is allowed and means seed-only", () => {
  for (const url of [undefined, "", "   "]) {
    const result = checkSupabaseUrl(url);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.normalized, "");
  }
});

test("known Windows and Node variables are preserved", () => {
  const base = baseEnv();
  const env = e2eServerEnv(base, undefined);
  for (const name of [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "SystemDrive",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "COMSPEC",
  ]) {
    assert.equal(env[name], base[name], `${name} must be preserved`);
  }
  assert.equal(env.NODE_ENV, "development");
});

test("unknown variables are not inherited", () => {
  const base = baseEnv();
  base.SOMETHING_THE_APP_ADDS_LATER = CANARY;
  base.AWS_SECRET_ACCESS_KEY = CANARY;
  base.RANDOM_EXPORT = CANARY;

  const env = e2eServerEnv(base, undefined);
  for (const name of ["SOMETHING_THE_APP_ADDS_LATER", "AWS_SECRET_ACCESS_KEY", "RANDOM_EXPORT"]) {
    assert.equal(env[name], undefined, `${name} must not be inherited`);
  }
  assert.ok(!Object.values(env).includes(CANARY), "a parent value leaked");
});

test("every listed forbidden variable is excluded", () => {
  const base = { ...baseEnv(), ...secretEnv() };
  const env = e2eServerEnv(base, "http://127.0.0.1:54321");
  for (const name of FORBIDDEN_VARIABLES) {
    assert.equal(env[name], undefined, `${name} must be excluded`);
  }
  assert.equal(env.CANARY_SECRET, undefined, "unlisted canary must be excluded");
  assert.ok(!JSON.stringify(env).includes(CANARY), "a forbidden value leaked");
});

test("both Supabase URL variables equal the validated loopback URL", () => {
  const base = baseEnv();
  base.SUPABASE_URL = "http://127.0.0.1:54321/ignored/path";
  base.NEXT_PUBLIC_SUPABASE_URL = "https://staging-remote.example.supabase.co";
  const env = e2eServerEnv(base, base.SUPABASE_URL);
  assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
});

test("unconfigured Supabase sets both variables to empty strings", () => {
  const base = baseEnv();
  base.NEXT_PUBLIC_SUPABASE_URL = "https://staging-remote.example.supabase.co";
  const env = e2eServerEnv(base, undefined);
  assert.equal(env.SUPABASE_URL, "");
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "");
});

test("explicit undefined never reads the ambient process environment", () => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = "http://127.0.0.1:9999";
  try {
    const env = e2eServerEnv(baseEnv(), undefined);
    assert.equal(env.SUPABASE_URL, "", "must not pick up process.env.SUPABASE_URL");
    assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "");
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous;
  }
});

test("server env throws instead of building against a remote host", () => {
  assert.throws(
    () => e2eServerEnv(baseEnv(), "https://abcdefghijkl.supabase.co"),
    /remote host/i,
  );
});

test("each blocked Next.js env file is detected", () => {
  for (const name of BLOCKED_ENV_FILES) {
    const dir = mkdtempSync(path.join(tmpdir(), "fyndra-envcheck-"));
    try {
      writeFileSync(path.join(dir, name), "SUPABASE_URL=https://not-read.example\n");
      assert.equal(findBlockingEnvFile(dir), name, `${name} must be detected`);
      assert.throws(
        () => assertNoEnvFiles(dir),
        (err: Error) => {
          assert.match(err.message, new RegExp(name.replace(/\./g, "\\.")));
          assert.doesNotMatch(err.message, /not-read\.example/);
          return true;
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("env-file guard inspects the project root, not the caller's cwd", () => {
  // Resolved from the module location, and absolute, so `process.chdir` cannot
  // move it. `path.resolve` of a call-time cwd would.
  assert.equal(path.isAbsolute(PROJECT_ROOT), true);
  assert.equal(PROJECT_ROOT, path.resolve(PROJECT_ROOT));
  assert.ok(existsSync(path.join(PROJECT_ROOT, "package.json")));

  const decoy = mkdtempSync(path.join(tmpdir(), "fyndra-cwd-decoy-"));
  const previousCwd = process.cwd();
  try {
    writeFileSync(path.join(decoy, ".env.local"), "SUPABASE_URL=>x\n");
    process.chdir(decoy);

    // Default directory is the project, so a decoy cwd is irrelevant.
    assert.equal(findBlockingEnvFile(), findBlockingEnvFile(PROJECT_ROOT));
    // The decoy is found only when explicitly named.
    assert.equal(findBlockingEnvFile(process.cwd()), ".env.local");
  } finally {
    process.chdir(previousCwd);
    rmSync(decoy, { recursive: true, force: true });
  }
});

test("a directory without env files passes the check", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fyndra-envcheck-clean-"));
  try {
    writeFileSync(path.join(dir, ".env.example"), "SUPABASE_URL=\n");
    writeFileSync(path.join(dir, ".env.staging.local"), "SUPABASE_URL=\n");
    assert.equal(findBlockingEnvFile(dir), null);
    assert.doesNotThrow(() => assertNoEnvFiles(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the dev server binds to loopback on the dedicated port", () => {
  assert.equal(E2E_HOST, "127.0.0.1");
  assert.equal(E2E_PORT, 3101);
  assert.equal(E2E_BASE_URL, "http://127.0.0.1:3101");
  assert.notEqual(E2E_PORT, 3100, "the E2E port must not collide with the dev port");
  assert.deepEqual(devServerArgs(), ["dev", "--port", "3101", "--hostname", "127.0.0.1"]);
  assert.ok(nextCliPath().endsWith(path.join("next", "dist", "bin", "next")));
});

test("the allowlist matches what the launcher copies", () => {
  const env = e2eServerEnv(baseEnv(), undefined);
  for (const name of Object.keys(env)) {
    if (name === "NODE_ENV" || name === "NEXT_TELEMETRY_DISABLED") continue;
    if (name === "SUPABASE_URL" || name === "NEXT_PUBLIC_SUPABASE_URL") continue;
    assert.ok(ALLOWED_VARIABLES.includes(name), `${name} is not on the allowlist`);
  }
});

test("a really spawned child sees no parent secret (QA failure mode)", async () => {
  process.env.CANARY_SECRET = CANARY;
  try {
    const seen = await envSeenBySpawnedChild(
      { ...baseEnv(), ...secretEnv() },
      "http://127.0.0.1:54321",
    );

    assert.equal(seen.CANARY_SECRET, undefined, "CANARY_SECRET reached the child");
    for (const name of FORBIDDEN_VARIABLES) {
      assert.equal(seen[name], undefined, `${name} reached the child`);
    }
    assert.ok(!JSON.stringify(seen).includes(CANARY), "a canary value reached the child");

    // Runtime plumbing must still work.
    for (const name of ["PATH", "SystemRoot", "TEMP", "USERPROFILE"]) {
      assert.ok(seen[name], `${name} must survive for the child to run`);
    }
    assert.equal(seen.NODE_ENV, "development");
  } finally {
    delete process.env.CANARY_SECRET;
  }
});

test("a really spawned child receives both Supabase URLs as the loopback", async () => {
  const seen = await envSeenBySpawnedChild(
    { ...baseEnv(), NEXT_PUBLIC_SUPABASE_URL: "https://staging-remote.example.supabase.co" },
    "http://127.0.0.1:54321",
  );
  assert.equal(seen.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(seen.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
});

test("a really spawned child gets empty URLs when Supabase is unconfigured", async () => {
  const seen = await envSeenBySpawnedChild(
    { ...baseEnv(), SUPABASE_URL: "https://staging-remote.example.supabase.co" },
    undefined,
  );
  assert.equal(seen.SUPABASE_URL, "");
  assert.equal(seen.NEXT_PUBLIC_SUPABASE_URL, "");
});

test("spawnDevServer runs the Next CLI with only the allowlisted env", async () => {
  // A stand-in for `node_modules/next/dist/bin/next`: it records the argv it
  // was invoked with and the environment it actually received, then exits.
  const root = mkdtempSync(path.join(tmpdir(), "fyndra-launcher-"));
  const reportPath = path.join(root, "report.json");
  const binDir = path.join(root, "node_modules", "next", "dist", "bin");
  mkdirSync(binDir, { recursive: true });
  const fakeNext = path.join(binDir, "next");
  writeFileSync(
    fakeNext,
    [
      `require("node:fs").writeFileSync(`,
      `  ${JSON.stringify(reportPath)},`,
      `  JSON.stringify({ argv: process.argv.slice(2), env: process.env })`,
      `);`,
    ].join("\n"),
  );

  const env = e2eServerEnv(
    { ...baseEnv(), ...secretEnv() },
    "http://127.0.0.1:54321",
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawnDevServer({
        env,
        cwd: root,
        scriptPath: fakeNext,
        args: devServerArgs(),
        stdio: "ignore",
      });
      child.once("error", reject);
      child.once("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`spawnDevServer exited ${code}`)),
      );
    });

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      argv: string[];
      env: Record<string, string>;
    };

    // The Next CLI is started as `next dev --port 3101 --hostname 127.0.0.1`.
    assert.deepEqual(report.argv, ["dev", "--port", "3101", "--hostname", "127.0.0.1"]);

    // ...and it observes only the allowlist, never a parent secret.
    assert.equal(report.env.CANARY_SECRET, undefined);
    for (const name of FORBIDDEN_VARIABLES) {
      assert.equal(report.env[name], undefined, `${name} reached the Next CLI`);
    }
    assert.ok(!JSON.stringify(report.env).includes(CANARY), "a canary reached the Next CLI");
    assert.equal(report.env.NODE_ENV, "development");
    assert.equal(report.env.SUPABASE_URL, "http://127.0.0.1:54321");
    assert.equal(report.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
    assert.ok(report.env.PATH, "PATH must survive so the CLI can run");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

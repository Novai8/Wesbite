/**
 * Module hooks so Node's test runner can load the app's TypeScript sources.
 *
 * Two gaps to bridge:
 *  - `@/...` path aliases from tsconfig (bundler resolution, no extension).
 *  - `import { NextResponse } from "next/server"`, which only resolves to
 *    `node_modules/next/server.js` under Next's own bundler.
 *
 * Plain JavaScript on purpose: tsconfig does not include `.mjs`, so this file
 * is never type-checked and may use Node 22+ APIs that @types/node 20 lacks.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT);

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

function resolveFile(basePath) {
  for (const suffix of EXTENSIONS) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const hit = resolveFile(fileURLToPath(new URL(specifier.slice(2), SRC)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    if (specifier === "next/server") {
      const hit = resolveFile(fileURLToPath(new URL("node_modules/next/server", ROOT)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
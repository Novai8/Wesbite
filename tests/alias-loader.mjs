/**
 * Minimal resolver so `node --test` can follow the app's `@/` path alias and
 * extensionless TypeScript imports. Node strips types natively; it just needs
 * help locating files.
 */

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

function resolveFile(base) {
  for (const suffix of candidates) {
    const full = base + suffix;
    if (!existsSync(full)) continue;
    // A bare specifier such as `@/lib/admitad` names a directory; returning it
    // makes Node try to read a folder as a module (EISDIR).
    try {
      if (statSync(full).isFile()) return full;
    } catch {
      // ignore unreadable entries
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Next publishes extensionless subpaths that its bundler resolves but bare
  // Node ESM does not (`next/server` -> `next/server.js`). Route-level tests
  // import the real handler, so map it here instead of changing app code.
  if (specifier === "next/server") {
    return { url: pathToFileURL(path.join(projectRoot, "tests", "next-server-shim.mjs")).href, shortCircuit: true };
  }

  if (specifier === "next/cache") {
    return { url: pathToFileURL(path.join(projectRoot, "tests", "next-server-shim.mjs")).href, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const base = path.join(projectRoot, "src", specifier.slice(2));
    const file = resolveFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const file = resolveFile(path.resolve(parentDir, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

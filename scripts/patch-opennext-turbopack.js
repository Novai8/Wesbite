/**
 * Windows fix for @opennextjs/cloudflare's Turbopack chunk-inlining patch.
 *
 * Upstream bug (unfixed as of 1.20.18): getInlinableChunks() and friends filter
 * traced files with ".includes(".next/server/chunks/")" (forward slashes), but
 * tracedFiles entries are built with path.join() - backslashes on Windows. The
 * generated requireChunk() switch therefore ends up empty, every chunk load
 * throws "Not found server/chunks/...", page/route modules never export
 * `handler`, and every SSR route 500s with
 * "components.ComponentMod.handler is not a function".
 *
 * This script normalizes path separators in the four affected generators:
 *   - getInlinableChunks          (requireChunk switch)
 *   - loadWasmChunkFn             (loadWasmChunk switch)
 *   - discoverBareExternalImports (chunk scan for external imports)
 *   - discoverExternalModuleMappings (.next dir derivation + symlink targets)
 *
 * Idempotent: no-ops when the fix is present or upstream has changed the file.
 * Wired as the `postinstall` npm script so `npm install` re-applies it.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Node CJS postinstall script */
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "build",
  "patches",
  "plugins",
  "turbopack.js",
);

// [before, after] pairs. Each pair must match once, or already be present.
const replacements = [
  // 1) getInlinableChunks: normalize separators, fix the skip check (exact-match
  //    against absolute paths never hit), match on the normalized path.
  [
    `function getInlinableChunks(tracedFiles) {
    const chunks = new Set();
    for (const file of tracedFiles) {
        if (file === "[turbopack]_runtime.js") {
            continue;
        }
        if (file.includes(".next/server/chunks/")) {
            chunks.add(file);
        }
    }
    return Array.from(chunks);
}`,
    `function getInlinableChunks(tracedFiles) {
    const chunks = new Set();
    for (const file of tracedFiles) {
        // tracedFiles are OS-native paths (built with path.join), so on Windows they
        // contain backslashes. Normalize to forward slashes so the ".next/server/chunks/"
        // filter matches and the generated switch case labels equal the relative chunk
        // paths the runtime passes in (which are always forward-slash).
        const normalized = file.replace(/\\\\/g, "/");
        if (normalized.endsWith("[turbopack]_runtime.js")) {
            continue;
        }
        if (normalized.includes(".next/server/chunks/")) {
            chunks.add(normalized);
        }
    }
    return Array.from(chunks);
}`,
  ],
  // 2) discoverBareExternalImports: chunk scan saw zero files on Windows.
  [
    `const chunkFiles = tracedFiles.filter((f) => f.includes(".next/server/chunks/"));`,
    `const chunkFiles = tracedFiles.map((f) => f.replace(/\\\\/g, "/")).filter((f) => f.includes(".next/server/chunks/"));`,
  ],
  // 3) discoverExternalModuleMappings: the /\/server\/chunks\/.*$/ replace never
  //    matched Windows separators, so .next/node_modules was never found.
  [
    `const dotNextDir = filePath.replace(/\\/server\\/chunks\\/.*$/, "");`,
    `const dotNextDir = filePath.replace(/\\\\/g, "/").replace(/\\/server\\/chunks\\/.*$/, "");`,
  ],
  // 4) Same function: symlink targets like "..\\..\\node_modules\\shiki".
  [`const match = target.match(/node_modules\\/(.+)$/);`, `const match = target.match(/node_modules[\\\\/](.+)$/);`],
  // 5) loadWasmChunkFn: normalize before the relPath derivation. Anchor on the
  //    unique head of the statement; the relPath tail stays untouched and
  //    becomes correct once absPath is forward-slashed by the added map.
  [
    `const cases = wasmFiles
        .map((absPath) => ({ absPath, relPath: absPath.replace`,
    `const cases = wasmFiles
        .map((f) => f.replace(/\\\\/g, "/"))
        .map((absPath) => ({ absPath, relPath: absPath.replace`,
  ],
];

if (!fs.existsSync(target)) {
  console.log("[patch-opennext-turbopack] target not found, skipping:", target);
  process.exit(0);
}

let code = fs.readFileSync(target, "utf8");
let applied = 0;
for (const [before, after] of replacements) {
  if (code.includes(after)) {
    applied++; // already patched (fix present or upstream fixed)
    continue;
  }
  if (!code.includes(before)) {
    console.log("[patch-opennext-turbopack] pattern not found (upstream changed? skipping piece):", before.slice(0, 80));
    continue;
  }
  code = code.replace(before, after);
  applied++;
}

fs.writeFileSync(target, code);
console.log(`[patch-opennext-turbopack] ${applied}/${replacements.length} replacements in place.`);
if (applied < replacements.length) {
  console.log("[patch-opennext-turbopack] some patterns were not found - check upstream for changes.");
}

#!/usr/bin/env node
/**
 * Smoke test for src/lib/glb.ts against real artefacts.
 *
 *   node scripts/check-glb.mjs .tmp/3d-agent/fixtures/sf3d-chair1.glb
 *
 * Exits non-zero if the good GLB fails validation or any bad variant is
 * accepted. Uses Node's built-in TS stripping, so no build step is needed.
 */

import { readFile } from "node:fs/promises";
import { parseGlb, isValidGlb } from "../src/lib/glb.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/check-glb.mjs <file.glb>");
  process.exit(2);
}

const bytes = new Uint8Array(await readFile(path));
const summary = parseGlb(bytes);
console.log("valid GLB:", summary);

const checks = [
  ["truncated", bytes.slice(0, Math.floor(bytes.length / 2))],
  ["not-a-glb", new TextEncoder().encode("MZ" + "0".repeat(200))],
  ["empty", new Uint8Array(0)],
];

let failed = false;
for (const [name, variant] of checks) {
  if (isValidGlb(variant)) {
    console.error(`FAIL: ${name} was accepted`);
    failed = true;
  } else {
    console.log(`rejected as expected: ${name}`);
  }
}

if (summary.meshCount < 1) {
  console.error("FAIL: no meshes");
  failed = true;
}

process.exit(failed ? 1 : 0);

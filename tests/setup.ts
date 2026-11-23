/**
 * Test setup: installs a no-op `fetch` guard and documents that every unit test
 * here runs fully offline. Any accidental network call fails loudly rather than
 * depending on Admitad's availability or the developer's credentials.
 */

import { test, before, after } from "node:test";

const realFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = async (input) => {
    throw new Error(
      `Unit tests must not touch the network. Blocked fetch to: ${String(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      )}`,
    );
  };
});

after(() => {
  globalThis.fetch = realFetch;
});

test("the network guard is installed for every unit test file", () => {
  // This file is imported by each suite for its side effect.
});
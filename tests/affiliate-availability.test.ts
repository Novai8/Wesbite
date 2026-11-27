import assert from "node:assert/strict";
import { test } from "node:test";
import { getAffiliateButtonState } from "../src/lib/affiliate-availability.ts";

test("unknown availability keeps the tracked merchant-check link enabled", () => {
  assert.deepEqual(getAffiliateButtonState("unknown"), {
    kind: "link",
    label: "Check availability at merchant — Affiliate",
  });
});

test("in-stock availability uses the normal buy action", () => {
  assert.deepEqual(getAffiliateButtonState("in_stock"), {
    kind: "link",
    label: "Buy at merchant — Affiliate",
  });
});

test("only explicitly out-of-stock products disable the purchase action", () => {
  assert.deepEqual(getAffiliateButtonState("out_of_stock"), {
    kind: "disabled",
    label: "Currently unavailable",
  });
});

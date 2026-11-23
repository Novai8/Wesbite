import assert from "node:assert/strict";
import { test } from "node:test";
import { outboundPath, validateAffiliateUrl } from "../src/lib/affiliate.ts";

test("an Admitad tracking link on the programme domain is accepted", () => {
  const check = validateAffiliateUrl(
    "https://ad.admitad.com/g/9a03752bb275478cca00463f97455a/?subid=fyndra&ulp=https%3A%2F%2Fwww.aliexpress.com%2Fitem%2F1.html",
    "admitad",
  );
  assert.deepEqual(check, { ok: true });
});

test("a merchant URL is rejected for the Admitad programme", () => {
  // The most dangerous failure mode: storing the *destination* as the affiliate
  // URL would send traffic through an untracked link and earn nothing.
  const check = validateAffiliateUrl("https://www.aliexpress.com/item/1.html", "admitad");
  assert.equal(check.ok, false);
});

test("a look-alike host is rejected", () => {
  for (const url of [
    "https://ad.admitad.com.evil.example/g/1/",
    "https://evil-ad.admitad.com/g/1/",
    "https://admitad.com/g/1/",
  ]) {
    const check = validateAffiliateUrl(url, "admitad");
    assert.equal(check.ok, false, `${url} must not validate`);
  }
});

test("non-HTTPS and malformed links are rejected", () => {
  assert.equal(validateAffiliateUrl("http://ad.admitad.com/g/1/", "admitad").ok, false);
  assert.equal(validateAffiliateUrl("javascript:alert(1)", "admitad").ok, false);
  assert.equal(validateAffiliateUrl("not a url", "admitad").ok, false);
});

test("an unknown or inactive programme is rejected", () => {
  assert.equal(validateAffiliateUrl("https://ad.admitad.com/g/1/", "not-a-programme").ok, false);
});

test("AliExpress seed links still validate unchanged", () => {
  const check = validateAffiliateUrl("https://s.click.aliexpress.com/e/_c3yyKUxb", "aliexpress");
  assert.deepEqual(check, { ok: true });
});

test("outbound clicks always route through the internal redirect", () => {
  const path = outboundPath({ id: "admitad-20523-AE-1" }, "product-page");
  assert.match(path, /^\/api\/go\?/);
  const params = new URLSearchParams(path.split("?")[1]);
  assert.equal(params.get("id"), "admitad-20523-AE-1");
  assert.equal(params.get("src"), "product-page");
  // The destination must never appear in the outbound link.
  assert.equal(path.includes("admitad.com"), false);
});
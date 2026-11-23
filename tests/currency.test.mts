import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPrice } from "../src/lib/catalogue.ts";
import {
  ISO_4217_CODES,
  currencyOrDefault,
  isIsoCurrencyCode,
  normaliseCurrencyCode,
} from "../src/lib/currency.ts";
import { normaliseCurrency } from "../src/lib/admitad/mapper.ts";
import { CURRENCIES, parseShoppingInput } from "../src/lib/validation.ts";

/** Currency compatibility: any ISO 4217 code must survive end to end. */

test("accepts every ISO code the catalogue claims to support", () => {
  for (const code of ["USD", "EUR", "GBP", "AED", "PKR", "JPY", "INR", "SAR"]) {
    assert.ok(isIsoCurrencyCode(code), `${code} must be a valid ISO code`);
  }
  assert.ok(ISO_4217_CODES.includes("AED" as never));
  assert.ok(ISO_4217_CODES.includes("PKR" as never));
  assert.ok(ISO_4217_CODES.includes("JPY" as never));
});

test("rejects codes that are well-formed but not real currencies", () => {
  for (const code of ["AAA", "ZZZ", "ABC", "XXX", "US", "USDD", "", "  "]) {
    assert.equal(isIsoCurrencyCode(code), false, `${code} must be rejected`);
    assert.equal(normaliseCurrencyCode(code), undefined, `${code} must not normalise`);
  }
  assert.equal(isIsoCurrencyCode(undefined), false);
  assert.equal(isIsoCurrencyCode(4217), false);
});

test("normalises case and surrounding whitespace only for valid codes", () => {
  assert.equal(normaliseCurrencyCode(" aed "), "AED");
  assert.equal(normaliseCurrencyCode("pkr"), "PKR");
  assert.equal(normaliseCurrencyCode("jPy"), "JPY");
  assert.equal(normaliseCurrencyCode("aedx"), undefined);
});

test("currencyOrDefault falls back only when the value is absent", () => {
  assert.equal(currencyOrDefault("AED"), "AED");
  assert.equal(currencyOrDefault(undefined), "USD");
  assert.equal(currencyOrDefault(""), "USD");
  // An invalid code falls back too -- this is the untrusted-import path.
  assert.equal(currencyOrDefault("ZZZ"), "USD");
  assert.equal(currencyOrDefault("ZZZ", "AED"), "AED");
});

test("Admitad's normaliseCurrency accepts AED/PKR/JPY and rejects junk", () => {
  assert.equal(normaliseCurrency("AED"), "AED");
  assert.equal(normaliseCurrency("pkr"), "PKR");
  assert.equal(normaliseCurrency("JPY"), "JPY");
  assert.equal(normaliseCurrency("not-a-currency"), "USD");
  assert.equal(normaliseCurrency(undefined, "eur"), "EUR");
  assert.equal(normaliseCurrency(undefined, "bogus"), "USD");
});

test("formatPrice renders the real currency, never a silent dollar sign", () => {
  // Intl pads AED/GBP etc. with a non-breaking space; normalise for comparison.
  const flat = (value: string) => value.replace(/\u00a0/g, " ");

  assert.equal(flat(formatPrice(12.5, "USD")), "$12.50");
  assert.equal(flat(formatPrice(12.5, "EUR")), "€12.50");
  assert.equal(flat(formatPrice(12.5, "GBP")), "£12.50");
  assert.match(flat(formatPrice(1234, "AED")), /AED/);
  assert.match(flat(formatPrice(1234, "PKR")), /PKR/);
  assert.match(flat(formatPrice(1234, "JPY")), /¥/);

  for (const code of ["AED", "PKR", "JPY"]) {
    const rendered = flat(formatPrice(1234, code));
    assert.notEqual(rendered, flat(formatPrice(1234, "USD")), `${code} must not render as USD`);
    assert.ok(!rendered.startsWith("$"), `${code} must not use a dollar sign`);
  }
});

test("formatPrice is honest about a code Intl cannot resolve", () => {
  const rendered = formatPrice(10, "ZZZ");
  assert.ok(!rendered.includes("$"), "an unknown code must not become dollars");
  assert.match(rendered, /ZZZ/);
  assert.match(rendered, /10\.00/);
});

test("formatPrice survives missing or malformed currency", () => {
  assert.match(formatPrice(5, ""), /USD/);
  assert.match(formatPrice(5, undefined as unknown as string), /USD/);
  assert.match(formatPrice(Number.NaN, "USD"), /\$0\.00/);
});

test("parseShoppingInput accepts a wide ISO code", () => {
  const result = parseShoppingInput({ goal: "Desk lamp for study", currency: "AED" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.currency, "AED");
});

test("parseShoppingInput rejects an invalid currency instead of coercing to USD", () => {
  const result = parseShoppingInput({ goal: "Desk lamp for study", currency: "ZZZ" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /ISO 4217/);
});

test("parseShoppingInput defaults to USD only when currency is absent", () => {
  const absent = parseShoppingInput({ goal: "Desk lamp for study" });
  assert.equal(absent.ok, true);
  if (absent.ok) assert.equal(absent.value.currency, "USD");

  const empty = parseShoppingInput({ goal: "Desk lamp for study", currency: "" });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.value.currency, "USD");
});

test("the UI picker stays a documented subset of the ISO list", () => {
  // The picker is intentionally small; it must not drift into offering a code
  // the validator would reject.
  for (const code of CURRENCIES) {
    assert.ok(isIsoCurrencyCode(code), `picker code ${code} must be valid ISO`);
  }
});

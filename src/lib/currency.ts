/**
 * ISO 4217 currency handling.
 *
 * One source of truth for "is this a real three-letter currency code". The
 * catalogue stores whatever code the source supplied (`USD`, `AED`, `PKR`,
 * `JPY`, …) and never coerces an unknown code to USD: a wrong symbol is worse
 * than a visible code.
 */

/**
 * ISO 4217 codes the catalogue accepts. Deliberately a list rather than a
 * regex: `AAA`, `ZZZ` and similar are well-formed but not real currencies.
 */
export const ISO_4217_CODES = [
  "AED", "ARS", "AUD", "BGN", "BHD", "BRL", "CAD", "CHF", "CLP", "CNY",
  "COP", "CZK", "DKK", "EGP", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS",
  "INR", "ISK", "JOD", "JPY", "KES", "KRW", "KWD", "KZT", "MAD", "MXN",
  "MYR", "NGN", "NOK", "NZD", "OMR", "PHP", "PKR", "PLN", "QAR", "RON",
  "RSD", "RUB", "SAR", "SEK", "SGD", "THB", "TND", "TRY", "TWD", "UAH",
  "USD", "VND", "ZAR",
] as const;

type IsoCurrencyCode = (typeof ISO_4217_CODES)[number];

const ISO_SET: ReadonlySet<string> = new Set(ISO_4217_CODES);

/** True when `value` is a known ISO 4217 three-letter code. */
export function isIsoCurrencyCode(value: unknown): value is IsoCurrencyCode {
  return typeof value === "string" && ISO_SET.has(value.trim().toUpperCase());
}

/**
 * Uppercase a currency code when it is valid, otherwise return `undefined`.
 * Callers decide the fallback; this never invents one.
 */
export function normaliseCurrencyCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return ISO_SET.has(code) ? code : undefined;
}

/**
 * Uppercase a currency code, falling back only when the value is *absent*.
 * An invalid code still falls back: use this for imports, where the source is
 * untrusted. Validation paths use `normaliseCurrencyCode` so a bad code is
 * reported instead of silently replaced.
 */
export function currencyOrDefault(value: unknown, fallback = "USD"): string {
  return normaliseCurrencyCode(value) ?? normaliseCurrencyCode(fallback) ?? "USD";
}

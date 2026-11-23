/**
 * Product-feed parser.
 *
 * Admitad does not expose a product-data REST endpoint. Product data lives in
 * advertiser-uploaded feed *files*, whose URLs arrive on the ad-space programme
 * object (`products_csv_link`, `products_xml_link`, `feeds_info[]`). This module
 * turns those files into canonical `FeedRow`s.
 *
 * Deliberately dependency-free: the CSV and XML parsing here is small and
 * testable, and avoids shipping a general-purpose parser in a Worker bundle.
 *
 * Supported
 *  - CSV with quoted fields, embedded commas/quotes and CRLF line endings.
 *  - XML `<item>` / `<offer>` / `<product>` records with CDATA and attributes.
 *    Covers Yandex-Market (`<offer id="…">`), Google Merchant and generic
 *    Admitad exports.
 *  - JSON arrays, or `{ products | items | data | results: [...] }`.
 *
 * Not supported: gzip decoding (feeds are requested uncompressed), XSD
 * validation, or namespaced XPath. Column mapping is name-based and tolerant.
 */

import type { FeedFormat, FeedParseResult, FeedRow } from "./types";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC4180-style reader that also tolerates bare quotes and stray CRLF. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const trimmedFirstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const sep = delimiter ?? (trimmedFirstLine.includes("\t") ? "\t" : trimmedFirstLine.includes(";") && !trimmedFirstLine.includes(",") ? ";" : ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function csvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      if (!key) return;
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const RECORD_TAGS = ["item", "offer", "product", "entry"];

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function readAttributes(openTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(openTag)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/** Reads `name`, `name.attr` and one level of nested `parent.child` values. */
function readChildTags(block: string): Record<string, string> {
  const values: Record<string, string> = {};
  const re = /<([\w:.-]+)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(block)) !== null) {
    const tag = match[1];
    const attrs = readAttributes(match[2] ?? "");
    const inner = match[3] ?? "";
    const withoutCdata = inner.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
    const nested = withoutCdata.includes("<") ? readChildTags(inner) : {};

    if (Object.keys(nested).length > 0) {
      for (const [child, childValue] of Object.entries(nested)) {
        values[`${tag}.${child}`] = childValue;
      }
    } else {
      values[tag] = decodeXmlEntities(inner).trim();
    }

    for (const [attr, attrValue] of Object.entries(attrs)) {
      values[`${tag}.${attr}`] = attrValue;
    }
  }

  return values;
}

export function parseXmlRecords(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, "");

  for (const tag of RECORD_TAGS) {
    const records: Record<string, string>[] = [];
    const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      records.push({ ...readAttributes(match[1] ?? ""), ...readChildTags(match[2] ?? "") });
    }
    if (records.length > 0) return records;
  }

  return [];
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function parseJsonRecords(input: string): Record<string, string>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  const root = parsed as Record<string, unknown>;
  const list = Array.isArray(parsed) ? parsed : root?.products ?? root?.items ?? root?.data ?? root?.results;
  if (!Array.isArray(list)) return [];

  return list.slice(0, 5000).map((entry) => {
    const flat: Record<string, string> = {};
    if (entry && typeof entry === "object") {
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        if (value == null) continue;
        if (Array.isArray(value)) {
          flat[key] = value.filter((item) => typeof item === "string").join(",");
        } else if (typeof value === "object") {
          flat[key] = JSON.stringify(value);
        } else {
          flat[key] = String(value);
        }
      }
    }
    return flat;
  });
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/**
 * Canonical field -> accepted source column names. Ordered: first hit wins.
 * Generous on purpose — every advertiser names its columns differently.
 */
export const FIELD_ALIASES = {
  external_product_id: [
    "id", "productid", "product_id", "offerid", "offer_id", "offer.id",
    "sku", "vendorcode", "vendor_code", "article", "gaid", "external_id",
  ],
  title: ["title", "name", "productname", "product_name", "model", "offer.name"],
  description: ["description", "desc", "summary", "productdescription", "offer.description"],
  image_url: [
    "imageurl", "image_url", "image", "picture", "img", "imagelink", "image_link",
    "imageurls", "productimage", "product_image", "thumbnail", "offer.picture",
  ],
  product_url: ["url", "producturl", "product_url", "link", "deeplink", "affiliateurl", "affiliate_url", "offer.url"],
  price: ["price", "currentprice", "current_price", "saleprice", "sale_price", "sale_price_price"],
  original_price: ["oldprice", "old_price", "originalprice", "original_price", "listprice", "list_price", "price.old", "priceold"],
  currency: ["currency", "currencyid", "currency_id", "price.currency", "pricecurrency"],
  category: ["category", "categoryname", "category_name", "categorypath", "producttype", "google_product_category"],
  availability: ["availability", "available", "stock", "in_stock", "instock"],
  brand: ["brand", "vendor", "manufacturer"],
} as const;

type CanonicalField = keyof typeof FIELD_ALIASES;

export function normaliseKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_.]/g, "");
}

const LOOKUP: Record<string, CanonicalField> = (() => {
  const map: Record<string, CanonicalField> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CanonicalField, readonly string[]][]) {
    map[normaliseKey(field)] = field;
    for (const alias of aliases) map[normaliseKey(alias)] ??= field;
  }
  return map;
})();

export function canonicalField(column: string): CanonicalField | null {
  return LOOKUP[normaliseKey(column)] ?? null;
}

function pick(record: Record<string, string>, field: CanonicalField): string | undefined {
  const aliases = new Set(FIELD_ALIASES[field].map(normaliseKey));
  for (const [key, value] of Object.entries(record)) {
    if (aliases.has(normaliseKey(key)) && value?.trim()) return value.trim();
  }
  return undefined;
}

export function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\u00a0\s]/g, "").replace(/[^\d.,-]/g, "");
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalised =
    lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");

  const value = Number(normalised);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function normaliseAvailability(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (/(out[\s_-]?of[\s_-]?stock|unavailable|false|\b0\b)/.test(value)) return "out_of_stock";
  if (/(in[\s_-]?stock|available|true|\b1\b)/.test(value)) return "in_stock";
  return undefined;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export interface NormaliseFeedOptions {
  /** Fallback currency when the feed omits it. Defaults to USD. */
  defaultCurrency?: string;
  /** Cap rows processed; protects the Worker from enormous feeds. */
  maxRows?: number;
}

export function normaliseRecords(
  records: Record<string, string>[],
  options: NormaliseFeedOptions = {},
): Pick<FeedParseResult, "rows" | "skipped" | "unmappedColumns" | "totalRows"> {
  const maxRows = options.maxRows ?? 500;
  const defaultCurrency = (options.defaultCurrency ?? "USD").toUpperCase();
  const rows: FeedRow[] = [];
  const skipped: { index: number; reason: string }[] = [];

  const firstKeys = records[0] ? Object.keys(records[0]) : [];
  const unmappedColumns = firstKeys.filter((key) => !canonicalField(key));

  records.slice(0, maxRows).forEach((record, index) => {
    const productUrl = pick(record, "product_url");
    const title = pick(record, "title");
    const externalId = pick(record, "external_product_id");

    if (!productUrl) {
      skipped.push({ index, reason: "missing product_url" });
      return;
    }
    if (!/^https?:\/\//i.test(productUrl)) {
      skipped.push({ index, reason: "product_url is not absolute" });
      return;
    }
    if (!title) {
      skipped.push({ index, reason: "missing title" });
      return;
    }

    let host = "";
    try {
      host = new URL(productUrl).hostname;
    } catch {
      skipped.push({ index, reason: "product_url is malformed" });
      return;
    }

    rows.push({
      external_product_id: externalId ?? `${host}:${index}-${title.slice(0, 40)}`,
      title,
      description: pick(record, "description"),
      image_url: pick(record, "image_url"),
      product_url: productUrl,
      price: parseNumber(pick(record, "price")),
      original_price: parseNumber(pick(record, "original_price")),
      currency: (pick(record, "currency") ?? defaultCurrency).toUpperCase().slice(0, 3),
      category: pick(record, "category"),
      availability: normaliseAvailability(pick(record, "availability")),
      brand: pick(record, "brand"),
      raw: record,
    });
  });

  return { rows, skipped, unmappedColumns, totalRows: records.length };
}

export function detectFormat(input: string): FeedFormat {
  const head = input.slice(0, 400).trim();
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (head.startsWith("<")) return "xml";
  if (/[,\t;]/.test(head.split("\n")[0] ?? "")) return "csv";
  return "unknown";
}

/** Full pipeline: raw feed text -> canonical rows + diagnostics. */
export function parseFeed(input: string, options: NormaliseFeedOptions = {}): FeedParseResult {
  const format = detectFormat(input);
  let records: Record<string, string>[] = [];

  if (format === "json") records = parseJsonRecords(input);
  else if (format === "xml") records = parseXmlRecords(input);
  else if (format === "csv") records = csvToObjects(parseCsv(input));

  if (records.length === 0) {
    return { format, rows: [], skipped: [], unmappedColumns: [], totalRows: 0 };
  }

  return { format, ...normaliseRecords(records, options) };
}
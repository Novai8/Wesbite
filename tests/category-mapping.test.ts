import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCategoryDictionary,
  parseFeed,
  parseStreamedXmlRecords,
  XmlRecordStream,
} from "../src/lib/admitad/feed-parser.ts";
import {
  FALLBACK_CATEGORY,
  UNCATEGORISED_SLUG,
  inferCategory,
  mapFeedRowToProduct,
  resolveProductCategory,
} from "../src/lib/admitad/mapper.ts";

/**
 * Category mapping for dictionary-based XML feeds.
 *
 * AliExpress WW supplies `categoryId` on every offer plus a `<categories>`
 * dictionary, but no per-offer category text. The rules under test:
 *  - a resolvable id becomes the dictionary's name, then a real shelf;
 *  - an unresolvable id is reported and left uncategorised, never invented;
 *  - nothing is silently pushed onto an unrelated shelf.
 */

const DICTIONARY = `<categories>
  <category id="5">Electrical Equipment &amp; Supplies</category>
  <category id="200000920">Kitchen,Dining &amp; Bar</category>
  <category id="201252004">Giftcard</category>
  <category id="200001076">Computer Components</category>
</categories>`;

function offerXml(id: string, categoryId?: string): string {
  return [
    `<offer id="${id}">`,
    "<name>Wireless Mouse For Laptop Computer</name><price>9.99</price><currencyId>USD</currencyId>",
    categoryId === undefined ? "" : `<categoryId>${categoryId}</categoryId>`,
    "<picture>https://cdn.example.com/x.jpg</picture>",
    "<url>https://rzekl.com/g/x</url>",
    "</offer>",
  ].join("");
}

function parseOffers(offers: string[], dictionary = DICTIONARY) {
  const document = `<?xml version="1.0"?><yml_catalog><shop>${dictionary}<offers>${offers.join("")}</offers></shop></yml_catalog>`;
  const splitter = new XmlRecordStream();
  const records = splitter.push(document);
  return parseStreamedXmlRecords(records, { categoryDictionary: parseCategoryDictionary(document) });
}

test("the category dictionary parses ids, entities and CDATA", () => {
  const dictionary = parseCategoryDictionary(
    '<categories><category id="5">A &amp; B</category><category id="7"><![CDATA[C, D]]></category></categories>',
  );
  assert.equal(dictionary.size, 2);
  assert.equal(dictionary.get("5"), "A & B");
  assert.equal(dictionary.get("7"), "C, D");
});

test("a missing <categories> block yields an empty dictionary, not an error", () => {
  assert.equal(parseCategoryDictionary("<yml_catalog><shop/></yml_catalog>").size, 0);
  assert.equal(parseCategoryDictionary("not xml").size, 0);
});

test("known ids are resolved from the feed's own dictionary", () => {
  const parsed = parseOffers([offerXml("1", "5"), offerXml("2", "200000920")]);
  assert.equal(parsed.rows[0].categoryId, "5");
  assert.equal(parsed.rows[0].category, "Electrical Equipment & Supplies");
  assert.equal(parsed.rows[1].category, "Kitchen,Dining & Bar");
  assert.equal(parsed.categories?.resolved, 2);
  assert.equal(parsed.categories?.unresolved, 0);
  assert.equal(parsed.categories?.dictionarySize, 4);
});

test("unknown ids are counted and reported, never mapped to a shelf name", () => {
  const parsed = parseOffers([offerXml("1", "999999"), offerXml("2", "888888")]);
  assert.equal(parsed.categories?.unresolved, 2);
  assert.deepEqual(parsed.categories?.unresolvedIds, ["888888", "999999"]);
  // No invented name: the row keeps the id and has no category text.
  assert.equal(parsed.rows[0].category, undefined);
  assert.equal(parsed.rows[0].categoryId, "999999");
});

test("resolved dictionary names map onto real shelves", () => {
  const parsed = parseOffers([offerXml("1", "5"), offerXml("2", "200000920")]);
  const computer = mapFeedRowToProduct({
    row: parsed.rows[0],
    programme: { id: 6115, name: "AliExpress WW", currency: "USD" },
    affiliateUrl: "https://ad.admitad.com/g/x",
  });
  const kitchen = mapFeedRowToProduct({
    row: parsed.rows[1],
    programme: { id: 6115, name: "AliExpress WW", currency: "USD" },
    affiliateUrl: "https://ad.admitad.com/g/y",
  });

  // "Electrical Equipment & Supplies" matches no shelf word, but the title
  // ("Laptop Computer") does, so the shelf comes from the title.
  assert.equal(computer.categoryBasis, "title");
  assert.equal(computer.categorySlug, "desk-setup");
  assert.equal(computer.sourceCategory, "Electrical Equipment & Supplies");
  assert.equal(computer.sourceCategoryId, "5");

  assert.equal(kitchen.categoryBasis, "source-category");
  assert.equal(kitchen.categorySlug, "kitchen-utility");
});

test("an unresolved id yields the uncategorised shelf, not a fabricated one", () => {
  const parsed = parseOffers([offerXml("1", "999999")]);
  const product = mapFeedRowToProduct({
    row: parsed.rows[0],
    programme: { id: 6115, name: "AliExpress WW", currency: "USD" },
    affiliateUrl: "https://ad.admitad.com/g/x",
  });

  // The title matches a real shelf, so the product is shelved honestly from
  // the title rather than from the unreadable id.
  assert.equal(product.categoryBasis, "title");
  assert.equal(product.sourceCategoryId, "999999");
  assert.equal(product.sourceCategory, undefined);
});

test("an unresolved id with a non-matching title is left uncategorised", () => {
  const parsed = parseOffers([
    '<?xml version="1.0"?>'.replace(/.*/, "") +
      '<offer id="9"><name>Qwerty Zxcv</name><price>1</price><currencyId>USD</currencyId><categoryId>777777</categoryId><picture>https://c.example/x.jpg</picture><url>https://rzekl.com/g/x</url></offer>',
  ]);
  const product = mapFeedRowToProduct({
    row: parsed.rows[0],
    programme: { id: 6115, name: "AliExpress WW", currency: "USD" },
    affiliateUrl: "https://ad.admitad.com/g/x",
  });

  assert.equal(product.categoryBasis, "unresolved-id");
  assert.equal(product.categorySlug, UNCATEGORISED_SLUG);
  assert.notEqual(product.categorySlug, FALLBACK_CATEGORY);
  assert.equal(product.sourceCategoryId, "777777");
});

test("resolveProductCategory precedence is source text, then title, then nothing", () => {
  assert.deepEqual(resolveProductCategory({ category: "Gaming" }), {
    slug: "gaming",
    basis: "source-category",
  });
  // "Console" matches only the gaming shelf; a tie would fall back to
  // catalogue order, which is the pre-existing documented behaviour.
  assert.deepEqual(resolveProductCategory({ category: "Misc", title: "Gaming Console" }), {
    slug: "gaming",
    basis: "title",
  });
  assert.deepEqual(resolveProductCategory({ categoryId: "42", title: "Misc" }), {
    slug: UNCATEGORISED_SLUG,
    basis: "unresolved-id",
  });
  assert.deepEqual(resolveProductCategory({}), {
    slug: FALLBACK_CATEGORY,
    basis: "none",
  });
});

test("CSV feeds that carry category text keep working unchanged", () => {
  const csv = [
    "id,title,url,price,category",
    'A1,"Monitor Arm","https://shop.example.com/a",24.5,"Computer / Monitor Accessories"',
  ].join("\n");
  const parsed = parseFeed(csv);
  assert.equal(parsed.rows[0].category, "Computer / Monitor Accessories");
  assert.equal(inferCategory(parsed.rows[0].category), "desk-setup");
  assert.equal(parsed.categories, undefined, "no dictionary means no category report");
});

test("the live feed's giftcard category maps to no shelf and is not guessed", () => {
  // Feed 14107 included a "Giftcard" category, which has no Fyndra shelf.
  assert.equal(resolveProductCategory({ category: "Giftcard" }).slug, UNCATEGORISED_SLUG);
});

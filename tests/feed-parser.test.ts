import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalField,
  detectFormat,
  parseCsv,
  parseFeed,
  parseJsonRecords,
  parseNumber,
  parseXmlRecords,
} from "../src/lib/admitad/feed-parser.ts";

test("detectFormat recognises the three supported shapes", () => {
  assert.equal(detectFormat("id,title,url\n1,x,https://e.com/1"), "csv");
  assert.equal(detectFormat("<?xml version=\"1.0\"?><yml_catalog><shop/></yml_catalog>"), "xml");
  assert.equal(detectFormat('{"products":[]}'), "json");
  assert.equal(detectFormat("just some text"), "unknown");
});

test("parseCsv handles quotes, escaped quotes and embedded commas", () => {
  const csv = 'id,title,price\n1,"Monitor arm, gas",24.50\n2,"He said ""hi""",10\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ["1", "Monitor arm, gas", "24.50"]);
  assert.equal(rows[2][1], 'He said "hi"');
});

test("parseCsv strips a UTF-8 BOM and CRLF", () => {
  const rows = parseCsv("\uFEFFid,title\r\n1,Thing\r\n");
  assert.deepEqual(rows[0], ["id", "title"]);
  assert.deepEqual(rows[1], ["1", "Thing"]);
});

test("parseCsv detects a semicolon-delimited export", () => {
  const rows = parseCsv("id;title;price\n1;Thing;5,50\n");
  assert.deepEqual(rows[1], ["1", "Thing", "5,50"]);
});

test("parseXmlRecords reads Yandex-style <offer> attributes and children", () => {
  const xml = `<yml_catalog><shop><offers>
    <offer id="42" available="true">
      <name><![CDATA[Desk Lamp & Co]]></name>
      <price>19.99</price>
      <currencyId>USD</currencyId>
      <picture>https://cdn.example.com/lamp.jpg</picture>
      <url>https://shop.example.com/lamp</url>
      <categoryId>12</categoryId>
    </offer>
  </offers></shop></yml_catalog>`;
  const records = parseXmlRecords(xml);
  assert.equal(records.length, 1);
  assert.equal(records[0].id, "42");
  assert.equal(records[0].name, "Desk Lamp & Co");
  assert.equal(records[0].price, "19.99");
  assert.equal(records[0].url, "https://shop.example.com/lamp");
});

test("parseXmlRecords reads <item> children used by generic Admitad exports", () => {
  const xml = `<products><item><id>9</id><title>Keyboard</title><link>https://e.com/k</link><price>49</price><image>https://e.com/k.jpg</image></item></products>`;
  const records = parseXmlRecords(xml);
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Keyboard");
  assert.equal(records[0].link, "https://e.com/k");
});

test("parseJsonRecords accepts a bare array and a wrapped list", () => {
  assert.equal(parseJsonRecords('[{"id":"1","name":"A"}]').length, 1);
  assert.equal(parseJsonRecords('{"products":[{"id":"1"},{"id":"2"}]}').length, 2);
  assert.equal(parseJsonRecords("not json").length, 0);
});

test("canonicalField maps the many spellings advertisers use", () => {
  assert.equal(canonicalField("Product ID"), "external_product_id");
  assert.equal(canonicalField("offer_id"), "external_product_id");
  assert.equal(canonicalField("IMAGE_URL"), "image_url");
  assert.equal(canonicalField("oldprice"), "original_price");
  assert.equal(canonicalField("sale_price"), "price");
  assert.equal(canonicalField("something_else"), null);
});

test("parseNumber handles European and US decimal formats and symbols", () => {
  assert.equal(parseNumber("1,234.50"), 1234.5);
  assert.equal(parseNumber("1 234,50"), 1234.5);
  assert.equal(parseNumber("€12.99"), 12.99);
  assert.equal(parseNumber("0"), 0);
  assert.equal(parseNumber("abc"), undefined);
  assert.equal(parseNumber(undefined), undefined);
});

test("parseFeed maps a CSV feed end to end and reports unmapped columns", () => {
  const csv = [
    "offer_id,Product Name,Description,Image,URL,Price,OldPrice,Currency,Category,Availability,Brand,InternalNote",
    'A1,"Gas Spring Monitor Arm","A clamp-on arm for 13-32 inch monitors.","https://cdn.example.com/a.jpg","https://shop.example.com/a",24.50,29.99,USD,"Computers / Monitor Accessories",in stock,Ergo,"ignore me"',
  ].join("\n");

  const result = parseFeed(csv);
  assert.equal(result.format, "csv");
  assert.equal(result.totalRows, 1);
  assert.equal(result.rows.length, 1);

  const row = result.rows[0];
  assert.equal(row.external_product_id, "A1");
  assert.equal(row.title, "Gas Spring Monitor Arm");
  assert.equal(row.product_url, "https://shop.example.com/a");
  assert.equal(row.price, 24.5);
  assert.equal(row.original_price, 29.99);
  assert.equal(row.currency, "USD");
  assert.equal(row.availability, "in_stock");
  assert.equal(result.unmappedColumns.includes("InternalNote"), true);
});

test("parseFeed skips rows with no usable URL or title and says why", () => {
  const csv = [
    "id,title,url",
    "1,Good,https://shop.example.com/p/1",
    "2,No URL,",
    "3,,https://shop.example.com/p/3",
    "4,Relative,/p/4",
  ].join("\n");

  const result = parseFeed(csv);
  assert.equal(result.rows.length, 1);
  assert.equal(result.skipped.length, 3);
  assert.deepEqual(
    result.skipped.map((s) => s.reason),
    ["missing product_url", "missing title", "product_url is not absolute"],
  );
});

test("parseFeed returns an empty, explained result for unparseable input", () => {
  const result = parseFeed("total nonsense without structure");
  assert.equal(result.format, "unknown");
  assert.equal(result.rows.length, 0);
  assert.equal(result.totalRows, 0);
});

test("parseFeed respects maxRows", () => {
  const csv = ["id,title,url", ...Array.from({ length: 10 }, (_, i) => `${i},T${i},https://e.com/${i}`)].join("\n");
  assert.equal(parseFeed(csv, { maxRows: 3 }).rows.length, 3);
});
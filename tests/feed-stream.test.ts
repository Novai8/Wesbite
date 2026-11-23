import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyHttpStatus,
  streamFeed,
  streamFeedWithRetry,
  sniffFeedFormat,
} from "../src/lib/admitad/feed-stream.ts";
import { parseCategoryDictionary, parseStreamedXmlRecords, XmlRecordStream } from "../src/lib/admitad/feed-parser.ts";

/**
 * Streaming ingestion.
 *
 * These tests build synthetic payloads at the sizes that broke the old
 * buffered downloader, and assert on memory-relevant behaviour (record counts,
 * truncation reporting, and how much of the body was consumed) rather than on
 * wall-clock timing.
 */

function xmlOffer(id: number, categoryId = "5"): string {
  return [
    `<offer id="${1005000000000 + id}">`,
    `<name>Test product ${id} monitor arm</name>`,
    `<price>${(5 + (id % 20)).toFixed(2)}</price>`,
    `<currencyId>USD</currencyId>`,
    `<categoryId>${categoryId}</categoryId>`,
    `<picture>https://cdn.example.com/${id}.jpg</picture>`,
    `<url>https://rzekl.com/g/tracked-${id}</url>`,
    "</offer>",
  ].join("");
}

function buildXmlFeed(offerCount: number, options: { categoryId?: string; categories?: string } = {}): string {
  const categories =
    options.categories ??
    '<categories><category id="5">Electrical Equipment &amp; Supplies</category><category id="7">Kitchen</category></categories>';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<yml_catalog date="2026-11-22 09:00"><shop><name>AliExpress</name>',
    "<currencies><currency id=\"USD\" rate=\"1\"/></currencies>",
    categories,
    "<offers>",
    ...Array.from({ length: offerCount }, (_, i) => xmlOffer(i, options.categoryId)),
    "</offers></shop></yml_catalog>",
  ].join("\n");
}

/** A response whose body streams `chunks` one at a time. */
function streamingResponse(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "application/xml" }, ...init });
}

test("streams a large synthetic XML feed without buffering the document", async () => {
  const offerCount = 5_000;
  const feed = buildXmlFeed(offerCount);
  assert.ok(feed.length > 1_000_000, "fixture should be over 1 MB");

  // Feed it in 64 KB slices to exercise chunk-boundary handling.
  const chunks: string[] = [];
  for (let i = 0; i < feed.length; i += 65_536) chunks.push(feed.slice(i, i + 65_536));

  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () => streamingResponse(chunks)) as typeof fetch,
    maxRecords: 100_000,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.format, "xml");
  assert.equal(result.records.length, offerCount);
  assert.equal(result.truncated, false);
  assert.equal(result.categoryDictionary.get("5"), "Electrical Equipment & Supplies");

  const parsed = parseStreamedXmlRecords(result.records, {
    maxRows: offerCount,
    categoryDictionary: result.categoryDictionary,
  });
  assert.equal(parsed.totalRows, offerCount);
  assert.equal(parsed.rows.length, offerCount);
  assert.equal(parsed.rows[0].category, "Electrical Equipment & Supplies");
  assert.equal(parsed.categories?.resolved, offerCount);
  assert.equal(parsed.categories?.unresolved, 0);
});

test("a record split across chunks is never emitted half-parsed", async () => {
  const offer = xmlOffer(1);
  const split = Math.floor(offer.length / 2);
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () =>
      streamingResponse([
        `<?xml version="1.0"?><yml_catalog><shop><offers>${offer.slice(0, split)}`,
        `${offer.slice(split)}</offers></shop></yml_catalog>`,
      ])) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.records.length, 1);
  assert.match(result.records[0].xml, /^<offer id="1005000000001">/);
});

test("the record cap stops the read and reports truncation, never a clean end", async () => {
  const feed = buildXmlFeed(2_000);
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () => streamingResponse([feed])) as typeof fetch,
    maxRecords: 50,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.records.length, 50);
  assert.equal(result.truncated, true);
  assert.match(result.truncationReason ?? "", /record cap 50/);
});

test("the byte cap stops the read and reports truncation", async () => {
  const feed = buildXmlFeed(3_000);
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () => streamingResponse([feed])) as typeof fetch,
    maxBytes: 40_000,
    maxRecords: 100_000,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.truncated, true);
  assert.ok(result.bytes >= 40_000);
  assert.match(result.truncationReason ?? "", /MB read cap|read cap/);
});

test("cancellation by the caller aborts the transfer and imports nothing", async () => {
  const feed = buildXmlFeed(5_000);
  const chunks: string[] = [];
  for (let i = 0; i < feed.length; i += 1_024) chunks.push(feed.slice(i, i + 1_024));

  const controller = new AbortController();
  let chunksDelivered = 0;
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const encoder = new TextEncoder();
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        if (signal?.aborted) {
          streamController.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
          return;
        }
        if (chunksDelivered >= chunks.length) {
          streamController.close();
          return;
        }
        chunksDelivered += 1;
        streamController.enqueue(encoder.encode(chunks[chunksDelivered - 1]));
        // Abort part-way through the transfer.
        if (chunksDelivered === 5) controller.abort();
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/xml" } });
  }) as typeof fetch;

  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl,
    signal: controller.signal,
    maxRecords: 100_000,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "aborted");
  assert.ok(chunksDelivered < chunks.length, "the read must stop early");
  assert.match(result.message, /cancel/i);
});

test("malformed XML (unterminated record) is refused, not partially imported", async () => {
  const feed = `<?xml version="1.0"?><yml_catalog><shop><offers>${xmlOffer(1)}<offer id="99"><name>Cut off`;
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () => streamingResponse([feed])) as typeof fetch,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "malformed");
  assert.match(result.message, /ended inside a record|malformed/i);
});

test("XML with no product records is refused with an explanation", async () => {
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () =>
      streamingResponse(['<?xml version="1.0"?><yml_catalog><shop><offers></offers></shop></yml_catalog>'])) as typeof fetch,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "malformed");
  assert.match(result.message, /no product records/i);
});

test("an idle timeout aborts a stalled transfer instead of hanging", async () => {
  const encoder = new TextEncoder();
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode('<?xml version="1.0"?><yml_catalog><shop><offers>'));
        // Then stall forever, until the stream is aborted.
        signal?.addEventListener("abort", () => {
          streamController.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/xml" } });
  }) as typeof fetch;

  const started = Date.now();
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl,
    idleTimeoutMs: 120,
    totalTimeoutMs: 60_000,
  });
  const elapsed = Date.now() - started;

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "timeout");
  assert.ok(elapsed < 5_000, `should abort promptly, took ${elapsed}ms`);
  assert.match(result.message, /stopped sending data|timed out/i);
});

test("an expired signed link is classified as expired and is not retried", async () => {
  let calls = 0;
  const result = await streamFeedWithRetry("https://export.example.test/feed", {
    fetchImpl: (async () => {
      calls += 1;
      return new Response("<error>Link signature expired</error>", { status: 403 });
    }) as typeof fetch,
    attempts: 3,
    baseDelayMs: 1,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "expired");
  assert.equal(result.retryable, false);
  assert.equal(calls, 1, "an expired link must not be retried");
  assert.match(result.message, /expire/i);
});

test("a temporary advertiser overload is retried and then succeeds", async () => {
  let calls = 0;
  const feed = buildXmlFeed(2);
  const result = await streamFeedWithRetry("https://export.example.test/feed", {
    fetchImpl: (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("The advertiser's server is overloaded", { status: 503 });
      }
      return streamingResponse([feed]);
    }) as typeof fetch,
    attempts: 3,
    baseDelayMs: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(calls, 2, "overload should be retried once and then succeed");
});

test("persistent overload reports the failure after the retry budget", async () => {
  let calls = 0;
  const result = await streamFeedWithRetry("https://export.example.test/feed", {
    fetchImpl: (async () => {
      calls += 1;
      return new Response("server overloaded", { status: 503 });
    }) as typeof fetch,
    attempts: 3,
    baseDelayMs: 1,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "overloaded");
  assert.equal(calls, 3);
  assert.match(result.message, /overloaded|rate limiting/i);
});

test("HTTP error classification separates expiry, overload and server faults", () => {
  assert.equal(classifyHttpStatus(403).kind, "expired");
  assert.equal(classifyHttpStatus(403).retryable, false);
  assert.equal(classifyHttpStatus(404).kind, "expired");
  assert.equal(classifyHttpStatus(429).kind, "overloaded");
  assert.equal(classifyHttpStatus(429).retryable, true);
  assert.equal(classifyHttpStatus(503, "server overloaded").kind, "overloaded");
  assert.equal(classifyHttpStatus(504).kind, "timeout");
  assert.equal(classifyHttpStatus(500).kind, "overloaded");
  assert.equal(classifyHttpStatus(200).kind, "http_error");
});

test("CSV feeds still stream and parse through the same entry point", async () => {
  const csv = [
    "id;name;url;price;currencyId;categoryId",
    "1005012486166415;Bread Basket;https://rzekl.com/g/abc/;12.23;USD;7",
    "1005012486166416;Monitor Arm;https://rzekl.com/g/def/;24.50;USD;5",
  ].join("\n");

  const result = await streamFeed("https://export.example.test/feed.csv", {
    fetchImpl: (async () =>
      new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } })) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.format, "csv");
  assert.equal(result.text, csv);
  assert.equal(sniffFeedFormat(csv, "text/csv"), "csv");
});

test("category dictionary tolerates entities, CDATA and chunk splits", async () => {
  const block =
    '<categories><category id="5">Electrical Equipment &amp; Supplies</category>' +
    "<category id=\"7\"><![CDATA[Kitchen, Dining & Bar]]></category></categories>";
  const dictionary = parseCategoryDictionary(block);
  assert.equal(dictionary.get("5"), "Electrical Equipment & Supplies");
  assert.equal(dictionary.get("7"), "Kitchen, Dining & Bar");

  // Split the dictionary across chunks: the collector must still join it.
  const feed = `${block}<offers>${xmlOffer(1)}</offers>`;
  const result = await streamFeed("https://export.example.test/feed", {
    fetchImpl: (async () => streamingResponse([feed.slice(0, 40), feed.slice(40, 90), feed.slice(90)])) as typeof fetch,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.categoryDictionary.get("5"), "Electrical Equipment & Supplies");
});

test("unknown category ids are reported rather than invented", () => {
  const feed = buildXmlFeed(3, { categoryId: "999999" });
  const parsed = (() => {
    const records: Array<{ xml: string; attributes: Record<string, string> }> = [];
    const splitter = new XmlRecordStream();
    for (const block of splitter.push(feed)) records.push(block);
    return parseStreamedXmlRecords(records, { categoryDictionary: parseCategoryDictionary(feed) });
  })();

  assert.equal(parsed.categories?.unresolved, 3);
  assert.equal(parsed.categories?.resolved, 0);
  assert.deepEqual(parsed.categories?.unresolvedIds, ["999999"]);
  // The id is preserved even though no name is known.
  assert.equal(parsed.rows[0].categoryId, "999999");
  assert.equal(parsed.rows[0].category, undefined);
});

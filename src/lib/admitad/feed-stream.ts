/**
 * Streaming feed download.
 *
 * Buffering a whole export behind one 25s timer was wrong twice over:
 * the timer measured the entire transfer (so anything above roughly 14 MB at
 * the measured ~630 KB/s died mid-flight), and the failure looked exactly like
 * an expired signed link.
 *
 * This module streams:
 *  - XML records are emitted as soon as they close, so a chunk boundary can
 *    never yield a half-parsed row and the raw document is never retained;
 *  - CSV/JSON still need a full buffer (row boundaries are cheap but column
 *    quoting is not streamable here), so they are read incrementally into a
 *    string with the same caps;
 *  - the timeout is an *idle* timeout plus an absolute deadline, not one
 *    deadline for the whole file;
 *  - failures are classified: expired link, HTTP error, advertiser overload,
 *    timeout, malformed XML, oversize, empty, or caller cancellation;
 *  - hitting a cap is reported as truncation with a reason, never as a clean
 *    end of feed.
 *
 * No URL, token or `code` parameter is ever included in output or errors.
 */

import { parseCategoryDictionary, XmlRecordStream, type XmlRecordBlock } from "./feed-parser";
import { scrubFeedCredentials } from "./public-view";
import type { FeedFormat } from "./types";

export type FeedFailureKind =
  | "expired"
  | "http_error"
  | "overloaded"
  | "timeout"
  | "network"
  | "malformed"
  | "too_large"
  | "empty"
  | "aborted";

export interface FeedFailure {
  kind: FeedFailureKind;
  /** Operator-facing explanation. Never contains a URL or credential. */
  message: string;
  /** HTTP status, when a response was received. */
  status?: number;
  /** True when the same request could plausibly succeed later. */
  retryable: boolean;
}

export interface FeedStreamLimits {
  /** Abort when no bytes arrive for this long. */
  idleTimeoutMs?: number;
  /** Absolute deadline for the whole transfer. */
  totalTimeoutMs?: number;
  /** Hard cap on bytes accepted. */
  maxBytes?: number;
  /** Stop after this many XML records. */
  maxRecords?: number;
}

export const FEED_LIMITS = {
  idleTimeoutMs: 30_000,
  totalTimeoutMs: 600_000,
  /** Whole-catalogue ceiling. Individual runs cap rows far below this. */
  maxBytes: 256 * 1024 * 1024,
  maxRecords: 50_000,
} as const;

export interface FeedStreamProgress {
  bytes: number;
  records: number;
  elapsedMs: number;
}

export interface FeedStreamSuccess {
  ok: true;
  status: number;
  contentType: string | null;
  format: FeedFormat;
  bytes: number;
  /** XML only: complete record blocks. Empty for CSV/JSON. */
  records: XmlRecordBlock[];
  /** CSV/JSON only: the decoded body. Empty for XML. */
  text: string;
  /** XML only: the file's own `<categories>` dictionary. */
  categoryDictionary: Map<string, string>;
  /** True when a cap stopped the read before the document ended. */
  truncated: boolean;
  truncationReason?: string;
  progress: FeedStreamProgress;
}

export type FeedStreamResult = FeedStreamSuccess | ({ ok: false } & FeedFailure);

const OVERLOAD_PATTERN = /overload|too many requests|temporarily unavailable|try again later|service unavailable/i;

/**
 * Classifies a non-2xx response.
 *
 * A 400/401/403/404 on a signed export URL means the signature expired or was
 * rejected: retrying cannot help, the link must be refreshed. Only 408/429/5xx
 * are treated as transient.
 */
export function classifyHttpStatus(status: number, bodyHint = ""): FeedFailure {
  if (status === 429 || (status >= 500 && OVERLOAD_PATTERN.test(bodyHint))) {
    return {
      kind: "overloaded",
      status,
      retryable: true,
      message: `Feed host is rate limiting or overloaded (HTTP ${status}). Retry later; this is not a permission problem.`,
    };
  }
  if (status === 408 || status === 504) {
    return {
      kind: "timeout",
      status,
      retryable: true,
      message: `Feed host timed out (HTTP ${status}). Retry later.`,
    };
  }
  if (status >= 500) {
    return {
      kind: "overloaded",
      status,
      retryable: true,
      message: `Feed host returned a server error (HTTP ${status}). Retry later.`,
    };
  }
  if (status >= 400) {
    return {
      kind: "expired",
      status,
      retryable: false,
      message:
        `The signed feed link was rejected (HTTP ${status}). Signed export URLs expire and are per-publisher, ` +
        "so refresh the link from the ad-space programme endpoint or the Admitad dashboard.",
    };
  }
  return {
    kind: "http_error",
    status,
    retryable: false,
    message: `Feed download failed (HTTP ${status}).`,
  };
}

export interface StreamFeedOptions extends FeedStreamLimits {
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Called after each chunk, for logging/progress. */
  onProgress?: (progress: FeedStreamProgress) => void;
  /** Cooperative cancellation from the caller. */
  signal?: AbortSignal;
}

/** Category blocks are small; cap the buffer so a broken feed cannot grow it. */
const MAX_CATEGORY_BUFFER = 4 * 1024 * 1024;

/**
 * Collects the `<categories>` dictionary across chunk boundaries.
 *
 * The block usually precedes the offers, but not always. Buffering until
 * `</categories>` (or the cap) keeps a split tag from losing names; once
 * closed the buffer is released.
 */
class CategoryCollector {
  private buffer = "";
  private done = false;
  readonly dictionary = new Map<string, string>();

  push(chunk: string): void {
    if (this.done) return;
    if (!this.buffer && !/<categories[\s>]/i.test(chunk)) return;
    this.buffer += chunk;

    const close = this.buffer.search(/<\/categories>/i);
    if (close !== -1) {
      const block = this.buffer.slice(0, close + "</categories>".length);
      for (const [id, name] of parseCategoryDictionary(block)) this.dictionary.set(id, name);
      this.buffer = "";
      this.done = true;
      return;
    }
    if (this.buffer.length > MAX_CATEGORY_BUFFER) {
      this.buffer = "";
      this.done = true;
    }
  }
}

/** Sniffs the payload format from its first bytes. */
export function sniffFeedFormat(head: string, contentType: string | null): FeedFormat {
  const trimmed = head.replace(/^\uFEFF/, "").trimStart();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  if (trimmed.startsWith("<")) return "xml";
  if (/\bxml\b/i.test(contentType ?? "") ) return "xml";
  if (/json/i.test(contentType ?? "")) return "json";
  if (/csv|text\/plain/i.test(contentType ?? "")) return "csv";
  const firstLine = trimmed.slice(0, trimmed.indexOf("\n") === -1 ? trimmed.length : trimmed.indexOf("\n"));
  if (/[;,\t]/.test(firstLine)) return "csv";
  return "unknown";
}

/**
 * Streams a feed URL.
 *
 * XML record splitting happens in-flight; the raw document is discarded as it
 * is consumed. CSV/JSON are decoded incrementally into `text`, which is
 * bounded by `maxBytes`.
 */
export async function streamFeed(
  url: string,
  options: StreamFeedOptions = {},
): Promise<FeedStreamResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const idleTimeoutMs = options.idleTimeoutMs ?? FEED_LIMITS.idleTimeoutMs;
  const totalTimeoutMs = options.totalTimeoutMs ?? FEED_LIMITS.totalTimeoutMs;
  const maxBytes = options.maxBytes ?? FEED_LIMITS.maxBytes;
  const maxRecords = options.maxRecords ?? FEED_LIMITS.maxRecords;
  const startedAt = Date.now();

  const controller = new AbortController();
  let timedOut: "idle" | "total" | null = null;
  const abortWith = (reason: "idle" | "total") => {
    timedOut = reason;
    controller.abort();
  };

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => abortWith("idle"), idleTimeoutMs);
  };

  const totalTimer = setTimeout(() => abortWith("total"), totalTimeoutMs);
  const callerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", callerAbort, { once: true });

  try {
    armIdle();
    const res = await fetchImpl(url, {
      headers: {
        Accept: "text/csv, application/xml, text/xml, application/json, */*",
        "Accept-Encoding": "identity",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      let hint = "";
      try {
        hint = (await res.text()).slice(0, 400);
      } catch {
        hint = "";
      }
      return { ok: false, ...classifyHttpStatus(res.status, hint) };
    }
    if (!res.body) {
      return {
        ok: false,
        kind: "empty",
        status: res.status,
        retryable: false,
        message: "The feed response had no body. Nothing was imported.",
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const splitter = new XmlRecordStream();
    const categories = new CategoryCollector();
    const records: XmlRecordBlock[] = [];
    const chunks: string[] = [];

    let bytes = 0;
    let head = "";
    let format: FeedFormat = "unknown";
    let formatLocked = false;
    let truncated = false;
    let truncationReason: string | undefined;

    const stop = async (reason: string) => {
      truncated = true;
      truncationReason = reason;
      try {
        await reader.cancel();
      } catch {
        // Already closed; nothing to release.
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      armIdle();
      bytes += value.byteLength;
      const chunk = decoder.decode(value, { stream: true });

      if (!formatLocked) {
        head = (head + chunk).slice(0, 800);
        const detected = sniffFeedFormat(head, res.headers.get("content-type"));
        if (detected !== "unknown") {
          format = detected;
          formatLocked = true;
        }
      }

      // Records are appended one at a time so the record cap is enforced
      // *during* a chunk, not after it. A single large chunk must not be able
      // to overshoot the cap.
      let capReached = false;
      if (format === "xml") {
        categories.push(chunk);
        for (const record of splitter.push(chunk)) {
          if (records.length >= maxRecords) {
            capReached = true;
            break;
          }
          records.push(record);
        }
      } else {
        chunks.push(chunk);
      }

      options.onProgress?.({ bytes, records: records.length, elapsedMs: Date.now() - startedAt });

      if (bytes >= maxBytes) {
        await stop(`feed exceeded the ${Math.round(maxBytes / 1024 / 1024)} MB read cap`);
        break;
      }
      if (format === "xml" && (capReached || records.length >= maxRecords)) {
        await stop(`stopped after ${records.length} records (record cap ${maxRecords})`);
        break;
      }
    }

    // Flush whatever the decoder was holding.
    const tail = decoder.decode();
    if (tail) {
      if (format === "xml") {
        categories.push(tail);
        for (const record of splitter.push(tail)) {
          if (records.length >= maxRecords) {
            truncated = true;
            truncationReason = `stopped after ${records.length} records (record cap ${maxRecords})`;
            break;
          }
          records.push(record);
        }
      } else {
        chunks.push(tail);
      }
    }

    const elapsed = Date.now() - startedAt;
    const text = format === "xml" ? "" : chunks.join("");

    if (timedOut) {
      return {
        ok: false,
        kind: "timeout",
        status: res.status,
        retryable: true,
        message:
          timedOut === "idle"
            ? `The feed stopped sending data for ${Math.round(idleTimeoutMs / 1000)}s and the transfer was aborted after ${bytes} bytes. A partial feed is never imported.`
            : `The feed transfer exceeded the ${Math.round(totalTimeoutMs / 1000)}s deadline and was aborted after ${bytes} bytes. A partial feed is never imported.`,
      };
    }
    if (options.signal?.aborted) {
      return {
        ok: false,
        kind: "aborted",
        status: res.status,
        retryable: true,
        message: `The download was cancelled by the caller after ${bytes} bytes. Nothing was imported.`,
      };
    }
    if (bytes === 0) {
      return {
        ok: false,
        kind: "empty",
        status: res.status,
        retryable: false,
        message: "The feed response was empty. Nothing was imported.",
      };
    }
    if (format === "unknown") {
      return {
        ok: false,
        kind: "malformed",
        status: res.status,
        retryable: false,
        message:
          "The response did not look like CSV, XML or JSON, so it is not a usable product export. Nothing was imported.",
      };
    }

    if (format === "xml" && !truncated) {
      const end = splitter.finish();
      if (end.partialRecord) {
        return {
          ok: false,
          kind: "malformed",
          status: res.status,
          retryable: false,
          message:
            "The XML feed ended inside a record, so it is malformed or was cut off upstream. A partial file is never imported.",
        };
      }
      if (records.length === 0) {
        return {
          ok: false,
          kind: "malformed",
          status: res.status,
          retryable: false,
          message:
            "The response is XML but contains no product records (<item>, <offer>, <product> or <entry>). Nothing was imported.",
        };
      }
    }

    return {
      ok: true,
      status: res.status,
      contentType: res.headers.get("content-type"),
      format,
      bytes,
      records,
      text,
      categoryDictionary: categories.dictionary,
      truncated,
      truncationReason,
      progress: { bytes, records: records.length, elapsedMs: elapsed },
    };
  } catch (err) {
    if (timedOut) {
      return {
        ok: false,
        kind: "timeout",
        retryable: true,
        message: `The feed transfer timed out (${timedOut}). A partial feed is never imported.`,
      };
    }
    if (options.signal?.aborted) {
      return {
        ok: false,
        kind: "aborted",
        retryable: true,
        message: "The download was cancelled by the caller. Nothing was imported.",
      };
    }
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        kind: "aborted",
        retryable: true,
        message: "The feed download was aborted before it completed. Retry when the host is responsive.",
      };
    }
    return {
      ok: false,
      kind: "network",
      retryable: true,
      // A fetch failure message can echo the request URL, which for a signed
      // export carries the publisher id and access code. Scrub before it leaves.
      message: `The feed host could not be reached (${
        scrubFeedCredentials(err instanceof Error ? err.message : "unknown error")
      }). Retry later.`,
    };
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    options.signal?.removeEventListener("abort", callerAbort);
  }
}

/**
 * Retries only plausibly transient failures. An expired signature is never
 * retried: it needs a refreshed link, not another attempt.
 */
export async function streamFeedWithRetry(
  url: string,
  options: StreamFeedOptions & { attempts?: number; baseDelayMs?: number } = {},
): Promise<FeedStreamResult> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 800;
  let last: FeedStreamResult | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await streamFeed(url, options);
    if (result.ok) return result;
    last = result;
    if (!result.retryable || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
  }

  return last as FeedStreamResult;
}

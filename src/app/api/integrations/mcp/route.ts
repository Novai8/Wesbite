import { requireSupabaseUser, isAuthError } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;
const MCP_VERSION = "2025-03-26";
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 24;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function validateEndpoint(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a valid MCP server URL.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid MCP server URL."); }
  if (url.protocol !== "https:") throw new Error("For safety, MCP connections must use HTTPS.");
  if (url.username || url.password || url.hash) throw new Error("Remove credentials and fragments from the URL. Enter credentials in the token field.");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new Error("Private, local, and raw IP addresses are not allowed as MCP endpoints.");
  }
  return url;
}

async function readMcpResponse(response: Response): Promise<{ payload: any; sessionId: string | null }> {
  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    throw new Error("MCP server returned HTTP " + response.status + (message ? ": " + message : "."));
  }
  const sessionId = response.headers.get("mcp-session-id");
  const text = await response.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("MCP server response was too large.");
  if (!text.trim()) return { payload: null, sessionId };
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const data = text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean);
    for (const item of data.reverse()) {
      try { const payload = JSON.parse(item); if (payload && (payload.result || payload.error)) return { payload, sessionId }; } catch { /* Ignore SSE comments and non-JSON events. */ }
    }
    return { payload: null, sessionId };
  }
  try { return { payload: JSON.parse(text), sessionId }; }
  catch { throw new Error("MCP server returned an unsupported response format."); }
}

async function rpc(endpoint: URL, token: string, method: string, params?: unknown, sessionId?: string | null, notification = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (token) headers.Authorization = "Bearer " + token;
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify(notification
      ? { jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) }
      : { jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) }),
  });
  if (notification && (response.status === 202 || response.status === 204)) return { payload: null, sessionId: response.headers.get("mcp-session-id") || sessionId || null };
  return readMcpResponse(response);
}

async function initialize(endpoint: URL, token: string) {
  const init = await rpc(endpoint, token, "initialize", {
    protocolVersion: MCP_VERSION,
    capabilities: {},
    clientInfo: { name: "Rapigents", version: "1.0.0" },
  });
  if (init.payload?.error) throw new Error(String(init.payload.error.message || "MCP initialization failed."));
  if (!init.payload?.result) throw new Error("MCP server did not complete the initialization handshake.");
  const sessionId = init.sessionId;
  await rpc(endpoint, token, "notifications/initialized", undefined, sessionId, true);
  return sessionId;
}

export async function POST(request: Request) {
  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 30_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const clientKey = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  let bucket = requestWindows.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    requestWindows.set(clientKey, bucket);
  }
  if (bucket.count >= RATE_LIMIT) return NextResponse.json({ error: "Too many integration requests. Wait a minute and try again." }, { status: 429 });
  bucket.count += 1;
  if (requestWindows.size > 1000) {
    for (const [key, value] of requestWindows) if (value.resetAt <= now) requestWindows.delete(key);
  }

  const authenticatedUser = await requireSupabaseUser(request);
  if (isAuthError(authenticatedUser)) return authenticatedUser;


  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); }
  }

  let endpoint: URL;
  try { endpoint = validateEndpoint(body.endpoint); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid MCP endpoint." }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length > 8192) return NextResponse.json({ error: "Token is too long." }, { status: 400 });
  const action = body.action;

  try {
    const sessionId = await initialize(endpoint, token);
    if (action === "connect" || action === "list") {
      const listed = await rpc(endpoint, token, "tools/list", {}, sessionId);
      if (listed.payload?.error) throw new Error(String(listed.payload.error.message || "Could not list MCP tools."));
      const tools = Array.isArray(listed.payload?.result?.tools) ? listed.payload.result.tools : [];
      return NextResponse.json({
        connected: true,
        serverName: endpoint.hostname,
        tools: tools.slice(0, 100).map((tool: any) => ({
          name: typeof tool.name === "string" ? tool.name.slice(0, 120) : "",
          description: typeof tool.description === "string" ? tool.description.slice(0, 1000) : "",
          inputSchema: tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object", properties: {} },
        })).filter((tool: any) => tool.name),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "call") {
      if (typeof body.name !== "string" || body.name.length > 120) return NextResponse.json({ error: "Select a valid MCP tool." }, { status: 400 });
      const listed = await rpc(endpoint, token, "tools/list", {}, sessionId);
      const tools = Array.isArray(listed.payload?.result?.tools) ? listed.payload.result.tools : [];
      if (!tools.some((tool: any) => tool?.name === body.name)) return NextResponse.json({ error: "That tool is not exposed by this MCP server." }, { status: 403 });
      const args = body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments) ? body.arguments : {};
      const result = await rpc(endpoint, token, "tools/call", { name: body.name, arguments: args }, sessionId);
      if (result.payload?.error) throw new Error(String(result.payload.error.message || "MCP tool call failed."));
      const toolResult = result.payload?.result ?? null;
      if (toolResult && typeof toolResult === "object" && toolResult.isError === true) {
        return NextResponse.json({ error: "The MCP tool reported an error.", result: toolResult }, { status: 422, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ result: toolResult }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unknown action. Use connect, list, or call." }, { status: 400 });
  } catch (error) {
    // Never log request bodies, tokens, or endpoint query strings.
    const message = error instanceof Error ? error.message : "MCP connection failed.";
    return NextResponse.json({ error: message.slice(0, 600) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

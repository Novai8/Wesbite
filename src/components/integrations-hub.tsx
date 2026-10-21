"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleHelp, PlugZap, Search, ShieldCheck, Unplug, Workflow, XCircle } from "lucide-react";

type McpTool = { name: string; description: string; inputSchema: Record<string, unknown> };
type AppItem = { name: string; group: string; kind: string; description: string; note: string };
const apps: AppItem[] = [
  { name: "n8n", group: "Automation", kind: "Native MCP", description: "Discover, test, create and manage exposed workflows, depending on your n8n version and permissions.", note: "Use your n8n MCP endpoint, commonly ending in /mcp-server/http." },
  { name: "GitHub", group: "Developer", kind: "MCP server available", description: "Work with repositories, issues, pull requests, files and code through an authorized MCP server.", note: "Connect an MCP server configured with your GitHub permissions." },
  { name: "GitLab", group: "Developer", kind: "MCP server available", description: "Projects, merge requests, issues and repository operations through an MCP server.", note: "Bring a compatible MCP server and your own authorization." },
  { name: "Linear", group: "Project management", kind: "MCP server available", description: "Create and update issues, projects and team workflows where your server exposes those tools.", note: "Use your authorized Linear MCP endpoint." },
  { name: "Notion", group: "Knowledge", kind: "MCP server available", description: "Search pages and work with workspace content exposed by your MCP server.", note: "Grant only the Notion pages and actions you intend to expose." },
  { name: "Slack", group: "Communication", kind: "MCP server available", description: "Search messages and perform permitted workspace actions through your MCP server.", note: "Posting or messaging can affect other people. Review tool arguments before running." },
  { name: "Google Drive", group: "Files", kind: "Via MCP server", description: "Search, read and manage Drive files exposed by a compatible connector.", note: "Use a connector that authenticates to your own Google account." },
  { name: "Gmail", group: "Communication", kind: "Via MCP server", description: "Find and draft email actions supported by your connector.", note: "Sending email is an external side effect; review each action." },
  { name: "Google Calendar", group: "Productivity", kind: "Via MCP server", description: "Check calendars and create events if your connector exposes those tools.", note: "Use a trusted connector and grant the minimum calendar scopes." },
  { name: "Microsoft Outlook", group: "Communication", kind: "Via MCP server", description: "Email and calendar workflows through a compatible MCP connector.", note: "Your connector must implement Outlook actions and authorization." },
  { name: "Microsoft Teams", group: "Communication", kind: "Via MCP server", description: "Team messages and collaboration workflows exposed by your connector.", note: "Use your own Microsoft-authorized connector." },
  { name: "Airtable", group: "Data", kind: "Via MCP server", description: "Read and update bases and records supported by a compatible MCP server.", note: "Limit access to the bases you need." },
  { name: "Supabase", group: "Developer", kind: "MCP server available", description: "Database and project operations exposed by your configured MCP server.", note: "Prefer a development project and read-only credentials for testing." },
  { name: "PostgreSQL", group: "Data", kind: "Via MCP server", description: "Query database data through a server with carefully limited database permissions.", note: "Never connect a production superuser account." },
  { name: "MySQL", group: "Data", kind: "Via MCP server", description: "Run permitted database operations through your chosen MCP server.", note: "Use a dedicated least-privilege database user." },
  { name: "Zapier", group: "Automation", kind: "Via MCP server", description: "Trigger actions that your authorized connector makes available.", note: "Connector capabilities depend on your Zapier plan and setup." },
  { name: "Make", group: "Automation", kind: "Via MCP server", description: "Trigger or inspect automation scenarios where a compatible MCP bridge exists.", note: "An MCP bridge is required; this page does not create one for you." },
  { name: "HubSpot", group: "CRM", kind: "Via MCP server", description: "CRM records and sales workflows exposed by your connector.", note: "Use a private app or OAuth connector with limited scopes." },
  { name: "Salesforce", group: "CRM", kind: "Via MCP server", description: "Manage supported CRM operations through a connector configured for your account.", note: "Restrict object permissions and review write operations." },
  { name: "Pipedrive", group: "CRM", kind: "Via MCP server", description: "Work with deals, people and activities exposed by your MCP server.", note: "Your connector must provide Pipedrive tools." },
  { name: "WordPress", group: "Publishing", kind: "Via MCP server", description: "Manage posts and site content through a trusted connector.", note: "Use a restricted application password or OAuth connector." },
  { name: "Shopify", group: "Commerce", kind: "Via MCP server", description: "Work with products, orders and store operations supported by your connector.", note: "Grant the smallest practical set of store scopes." },
  { name: "Stripe", group: "Commerce", kind: "Via MCP server", description: "Inspect or manage permitted payment operations exposed by a connector.", note: "Never grant broad financial write permissions just to experiment." },
  { name: "Figma", group: "Design", kind: "Via MCP server", description: "Access design files and actions exposed by your MCP connector.", note: "Use a trusted server and scoped account access." },
  { name: "Canva", group: "Design", kind: "Via MCP server", description: "Design workflow actions where a compatible connector exists.", note: "A connector is required; native support is not implied." },
  { name: "Jira", group: "Project management", kind: "MCP server available", description: "Issues, projects and work management exposed by your Atlassian MCP setup.", note: "Connect your authorized Atlassian MCP endpoint." },
  { name: "Confluence", group: "Knowledge", kind: "Via MCP server", description: "Search and work with knowledge pages exposed by a connector.", note: "Limit the spaces and actions exposed to the server." },
  { name: "ClickUp", group: "Project management", kind: "Via MCP server", description: "Tasks and project workflows through a compatible connector.", note: "Connector capabilities vary." },
  { name: "Trello", group: "Project management", kind: "Via MCP server", description: "Boards, lists and cards exposed by your connector.", note: "Use a trusted connector with your own account authorization." },
  { name: "Discord", group: "Communication", kind: "Via MCP server", description: "Read or post in permitted servers through a compatible connector.", note: "Check channel permissions before enabling write actions." },
  { name: "Telegram", group: "Communication", kind: "Via MCP server", description: "Bot and messaging workflows supported by your connector.", note: "Keep bot tokens private and limit which chats can be affected." },
  { name: "Google Sheets", group: "Data", kind: "Via MCP server", description: "Read and update spreadsheet data exposed by your connector.", note: "Use a dedicated Google-authorized connector." },
  { name: "Cloudflare", group: "Developer", kind: "Via MCP server", description: "Manage supported account and developer operations through a compatible connector.", note: "Never use an account-wide API token if a narrower token will do." },
  { name: "Vercel", group: "Developer", kind: "Via MCP server", description: "Project and deployment operations exposed by a compatible connector.", note: "Deployment actions can change live sites." },
  { name: "Docker", group: "Developer", kind: "Via MCP server", description: "Container workflows provided by a trusted local or remote MCP server.", note: "Do not expose a privileged Docker socket to an untrusted server." },
  { name: "Browser automation", group: "Automation", kind: "Via MCP server", description: "Browser tasks exposed by a compatible Playwright or browser MCP server.", note: "Review actions before submitting forms or changing accounts." },
];

const groups = ["All apps", ...Array.from(new Set(apps.map((app) => app.group)))];

export function IntegrationsHub() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All apps");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [serverName, setServerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [argumentsText, setArgumentsText] = useState("{}");
  const [toolResult, setToolResult] = useState("");
  const [confirmCall, setConfirmCall] = useState(false);

  const visibleApps = useMemo(() => apps.filter((app) =>
    (group === "All apps" || app.group === group) &&
    (app.name + " " + app.description + " " + app.group).toLowerCase().includes(query.toLowerCase())
  ), [group, query]);

  async function connect() {
    setBusy(true); setError(""); setStatus(""); setToolResult("");
    try {
      const response = await fetch("/api/integrations/mcp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", endpoint: endpoint.trim(), token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect to the MCP server.");
      setTools(data.tools || []); setServerName(data.serverName || "MCP server"); setConnected(true);
      setStatus("Connected for this browser session. Credentials are not saved by Rapigents.");
      setSelectedTool(data.tools?.[0]?.name || "");
    } catch (e) { setConnected(false); setTools([]); setError(e instanceof Error ? e.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  function disconnect() {
    setConnected(false); setTools([]); setToken(""); setEndpoint(""); setServerName(""); setSelectedTool("");
    setArgumentsText("{}"); setToolResult(""); setStatus("Disconnected. The token was cleared from this page's memory.");
    setError(""); setConfirmCall(false);
  }

  async function runTool() {
    let args: unknown;
    try { args = JSON.parse(argumentsText); } catch { setError("Tool arguments must be valid JSON."); return; }
    if (!args || typeof args !== "object" || Array.isArray(args)) { setError("Tool arguments must be a JSON object."); return; }
    setBusy(true); setError(""); setToolResult(""); setConfirmCall(false);
    try {
      const response = await fetch("/api/integrations/mcp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "call", endpoint: endpoint.trim(), token, name: selectedTool, arguments: args }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The MCP tool call failed.");
      setToolResult(JSON.stringify(data.result, null, 2));
    } catch (e) { setError(e instanceof Error ? e.message : "The MCP tool call failed."); }
    finally { setBusy(false); }
  }

  return <main className="integrations-page">
    <section className="int-hero">
      <div className="int-shell">
        <div className="int-kicker"><span/> RAPIGENTS / CONNECTORS</div>
        <h1>Your tools.<br/><em>Your permission.</em></h1>
        <p className="int-lede">Connect services through MCP so an AI workflow can discover the tools you authorize, inspect their capabilities, and run approved actions. Your accounts stay yours.</p>
        <div className="int-hero-stats"><span><strong>35+</strong> service profiles</span><span><strong>MCP</strong> standard protocol</span><span><strong>0</strong> stored tokens</span></div>
      </div>
    </section>

    <section className="int-shell int-connect-section" id="connect">
      <div className="int-section-heading"><div><span className="int-label">01 / LIVE CONNECTION</span><h2>Connect an MCP server</h2></div><p>Works with standard MCP Streamable HTTP servers, including a configured n8n MCP endpoint. Most apps need their own MCP server or connector first.</p></div>
      <div className="int-connect-grid">
        <form className="int-connect-card" onSubmit={(e) => { e.preventDefault(); void connect(); }}>
          <div className="int-card-title"><span className="int-icon"><PlugZap size={18}/></span><div><strong>Custom MCP endpoint</strong><small>HTTPS · server-side requests · no saved credentials</small></div></div>
          <label htmlFor="mcp-endpoint">MCP server URL</label>
          <input id="mcp-endpoint" type="url" required value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://your-n8n.example.com/mcp-server/http" disabled={connected}/>
          <label htmlFor="mcp-token">Bearer token <span>(if required)</span></label>
          <input id="mcp-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your server token" disabled={connected}/>
          <div className="int-security-note"><ShieldCheck size={17}/><span>Token stays in page memory and is sent only over HTTPS to this site's MCP gateway. It is not written to localStorage, cookies, or a database. Refreshing clears it.</span></div>
          {error && <p className="int-error" role="alert"><XCircle size={15}/>{error}</p>}
          {status && <p className="int-status" role="status"><CheckCircle2 size={15}/>{status}</p>}
          {!connected ? <button className="int-primary" type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect and discover tools"} <ArrowRight size={16}/></button> : <button className="int-secondary" type="button" onClick={disconnect}><Unplug size={15}/> Disconnect and clear token</button>}
        </form>
        <div className="int-tools-card">
          <div className="int-card-title"><span className="int-icon"><Workflow size={18}/></span><div><strong>{connected ? serverName : "Discovered tools"}</strong><small>{connected ? tools.length + " tools exposed by your server" : "Tools appear here after a successful MCP handshake"}</small></div></div>
          {connected && tools.length > 0 ? <div className="int-tool-list">{tools.map((tool) => <button type="button" key={tool.name} className={selectedTool === tool.name ? "int-tool-row is-selected" : "int-tool-row"} onClick={() => { setSelectedTool(tool.name); setArgumentsText(JSON.stringify(Object.fromEntries(Object.entries((tool.inputSchema as any)?.properties || {}).map(([key, schema]: [string, any]) => [key, schema?.type === "string" ? "" : schema?.type === "boolean" ? false : schema?.type === "number" || schema?.type === "integer" ? 0 : null])), null, 2)); setToolResult(""); }}><span><strong>{tool.name}</strong><small>{tool.description || "No description supplied."}</small></span><ArrowRight size={14}/></button>)}</div> : <div className="int-empty"><PlugZap size={24}/><p>No tools discovered yet.</p><small>Connect a server to list the exact actions it exposes. Rapigents never assumes permissions that the server did not provide.</small></div>}
        </div>
      </div>

      {connected && selectedTool && <div className="int-runner">
        <div className="int-section-heading"><div><span className="int-label">02 / ACTION RUNNER</span><h2>Review before running</h2></div><p>Tool calls can change external accounts. Inspect the name and arguments before confirming the action.</p></div>
        <div className="int-runner-card">
          <div className="int-runner-top"><strong>{selectedTool}</strong><span>Explicit user confirmation required</span></div>
          <label htmlFor="mcp-arguments">Arguments (JSON object)</label>
          <textarea id="mcp-arguments" rows={7} spellCheck={false} value={argumentsText} onChange={(e) => setArgumentsText(e.target.value)} />
          <div className="int-runner-actions"><button className="int-secondary" type="button" onClick={() => setConfirmCall(true)} disabled={busy}>Review action</button>{confirmCall && <button className="int-primary" type="button" onClick={() => void runTool()} disabled={busy}>{busy ? "Running…" : "Confirm and run"} <ArrowRight size={15}/></button>}</div>
          {confirmCall && <p className="int-confirm-note"><CircleHelp size={15}/> This sends the selected tool name and JSON arguments to your connected MCP server using the token you provided. It may modify data or trigger external actions.</p>}
          {toolResult && <div className="int-result"><div><strong>Tool result</strong><button type="button" onClick={() => setToolResult("")}>Clear</button></div><pre>{toolResult}</pre></div>}
        </div>
      </div>}
    </section>

    <section className="int-directory-section">
      <div className="int-shell">
        <div className="int-section-heading"><div><span className="int-label">03 / CONNECTOR DIRECTORY</span><h2>Bring your stack.</h2></div><p>Service profiles help you find the right connector. They are not claims that every vendor provides an official MCP endpoint.</p></div>
        <div className="int-directory-controls"><label className="int-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search services or capabilities…"/></label><span>{visibleApps.length} services</span></div>
        <div className="int-filters">{groups.map((item) => <button type="button" key={item} className={group === item ? "is-active" : ""} onClick={() => setGroup(item)}>{item}</button>)}</div>
        <div className="int-app-grid">{visibleApps.map((app) => <article className="int-app-card" key={app.name}><div className="int-app-card-top"><span>{app.group}</span><i/></div><h3>{app.name}</h3><p>{app.description}</p><small>{app.kind}</small><details><summary>Connection notes</summary><p>{app.note}</p></details></article>)}</div>
        <p className="int-footnote">MCP compatibility depends on the actual server, its version, authentication method, exposed tools, and permissions. The directory is a discovery guide; only the live connection above verifies a server and its available tools.</p>
      </div>
    </section>
  </main>;
}

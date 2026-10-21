export type RapigentsMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type RapigentsMcpSession = {
  endpoint: string;
  token: string;
  serverName: string;
  tools: RapigentsMcpTool[];
};

// Deliberately memory-only. Never persist tokens in browser storage or cookies.
let activeSession: RapigentsMcpSession | null = null;

export function setMcpSession(session: RapigentsMcpSession | null) {
  activeSession = session;
}

export function getMcpSession() {
  return activeSession;
}

export function getMcpToolCatalog() {
  if (!activeSession) return [];
  return activeSession.tools.slice(0, 40).map((tool) => ({
    name: tool.name,
    description: tool.description.slice(0, 500),
    inputSchema: tool.inputSchema,
  }));
}

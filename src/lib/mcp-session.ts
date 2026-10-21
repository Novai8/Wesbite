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
  return activeSession.tools.slice(0, 40).map((tool) => {
    const schema = tool.inputSchema && typeof tool.inputSchema === "object"
      ? tool.inputSchema as { properties?: Record<string, unknown>; required?: unknown }
      : {};
    const properties = schema.properties && typeof schema.properties === "object"
      ? Object.fromEntries(Object.entries(schema.properties).slice(0, 25).map(([name, value]) => {
          const field = value && typeof value === "object"
            ? value as { type?: unknown; description?: unknown; enum?: unknown }
            : {};
          return [name.slice(0, 100), {
            type: typeof field.type === "string" ? field.type.slice(0, 40) : "unknown",
            description: typeof field.description === "string" ? field.description.slice(0, 160) : "",
            ...(Array.isArray(field.enum) ? { enum: field.enum.slice(0, 12).map((item) => String(item).slice(0, 80)) } : {}),
          }];
        }))
      : {};
    return {
      name: tool.name.slice(0, 120),
      description: tool.description.slice(0, 500),
      inputSchema: {
        properties,
        required: Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string").slice(0, 25) : [],
      },
    };
  });
}

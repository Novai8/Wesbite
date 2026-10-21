import type { Metadata } from "next";
import { IntegrationsHub } from "@/components/integrations-hub";
import "./integrations.css";

export const metadata: Metadata = {
  title: "Integrations & MCP Connectors",
  description: "Connect your own MCP-compatible services to Rapigents and discover automation integrations.",
  alternates: { canonical: "https://rapigents.com/integrations" },
};

export default function IntegrationsPage() {
  return <IntegrationsHub />;
}

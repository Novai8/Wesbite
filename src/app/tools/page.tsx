import type { Metadata } from "next";
import { ToolsLab } from "@/components/tools-lab";
import "./tools.css";

export const metadata: Metadata = {
  title: "AI Tools Lab",
  description: "A practical AI toolkit for business, writing, research, study, and automation.",
  openGraph: {
    title: "Rapigents AI Tools Lab",
    description: "Less busywork. More done.",
    url: "https://rapigents.com/tools",
    siteName: "Rapigents",
    type: "website",
  },
};

export default function ToolsPage() {
  return <ToolsLab />;
}

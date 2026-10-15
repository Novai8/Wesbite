import type { Metadata } from "next";
import { ToolsLab } from "@/components/tools-lab";
import "./tools.css";

export const metadata: Metadata = {
  title: "Free AI Tools for Writing, Research & Media",
  description: "Explore free AI writing, research, image analysis, audio transcription, video summarization, and productivity tools in one workspace.",
  openGraph: {
    title: "Free AI Tools for Writing, Research & Media | Rapigents",
    description: "Less busywork. More done.",
    url: "https://rapigents.com/tools",
    siteName: "Rapigents",
    type: "website",
  },
};

export default function ToolsPage() {
  return <ToolsLab />;
}

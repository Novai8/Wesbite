import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTool } from "@/data/tool-catalog";
import { ToolDetailWorkbench } from "@/components/tool-detail-workbench";
import "../tools.css";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tool = findTool(id);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: tool.name + ": a focused " + (tool.kind === "browser" ? "browser utility" : "AI-assisted tool") + " from Rapigents for " + tool.category.toLowerCase() + ".",
    alternates: { canonical: "https://rapigents.com/tools/" + tool.id },
    openGraph: {
      title: tool.name + " | Rapigents",
      description: tool.description,
      url: "https://rapigents.com/tools/" + tool.id,
      siteName: "Rapigents",
      type: "website",
    },
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { id } = await params;
  const tool = findTool(id);
  if (!tool) notFound();
  return <ToolDetailWorkbench tool={tool} />;
}

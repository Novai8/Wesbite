"use client";

import { useParams } from "next/navigation";
import { findTool } from "@/data/tool-catalog";
import { ToolLaunchVisual } from "@/components/tool-motion-visual";

export default function ToolLoading() {
  const params = useParams<{ id: string }>();
  const tool = findTool(params.id);
  return <main className="tool-launch-overlay" role="status" aria-live="polite">
    <div className="tool-launch-card">
      <div className="tool-launch-top"><span className="tools-live-dot"/> RAPIGENTS / TOOL INITIALIZING <span>{tool?.category.toUpperCase() || "WORKSPACE"}</span></div>
      {tool ? <ToolLaunchVisual tool={tool}/> : <div className="tool-motion-visual"><div className="tool-motion-orbit orbit-one"/><div className="tool-motion-orbit orbit-two"/></div>}
      <span className="tool-launch-label">{tool?.name || "Preparing your workspace"}</span>
      <span className="tool-launch-sub">Setting up your task-specific interface…</span>
    </div>
  </main>;
}

import type { Metadata } from "next";
import { ToolsLab } from "@/components/tools-lab";
import "./tools/tools.css";

export const metadata: Metadata = {
  title: "AI Tools Lab",
  description: "A practical AI toolkit for business, writing, research, study, and automation.",
};

export default function HomePage() {
  return <ToolsLab />;
}

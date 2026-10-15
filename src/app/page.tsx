import type { Metadata } from "next";
import { RapigentsHome } from "@/components/rapigents-home";
import "./home.css";

export const metadata: Metadata = {
  title: "Rapigents | Free AI Tools, Image Analyzer & Video Clipper",
  description: "Free AI tools for writing, research, image analysis, audio and video insights, and a video clipper for creating vertical shorts with captions."
};

export default function HomePage() {
  return <RapigentsHome />;
}

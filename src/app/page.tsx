import type { Metadata } from "next";
import { RapigentsHome } from "@/components/rapigents-home";
import "./home.css";

export const metadata: Metadata = {
  title: "Rapigents | Work, made visible",
  description: "Practical AI tools and business workflows that turn repetitive operations into clear, reviewable systems.",
};

export default function HomePage() {
  return <RapigentsHome />;
}

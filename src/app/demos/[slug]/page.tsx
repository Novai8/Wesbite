import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { demos } from "@/data/demos";
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return demos.map((demo) => ({ slug: demo.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: Props): Promise<Metadata> { await params; return { title: "AI Tools", description: "Explore Rapigents AI tools and browser utilities." }; }
export default function DemoDetailPage() { redirect("/tools"); }

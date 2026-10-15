import { redirect } from "next/navigation";
export const metadata = { title: "AI Tools", description: "Explore the Rapigents AI tools and browser utilities." };
export default function DemosPage() { redirect("/tools"); }

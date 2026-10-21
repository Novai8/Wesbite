import type { MetadataRoute } from "next";
import { demos } from "@/data/demos";
import { toolCatalog } from "@/data/tool-catalog";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-24");
  return [
    { url: site.url, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/demos`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site.url}/tools`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site.url}/integrations`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/clip-ai`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/about`, lastModified, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site.url}/reviews`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site.url}/contact`, lastModified, changeFrequency: "yearly", priority: 0.6 },
    ...toolCatalog.map((tool) => ({
      url: `${site.url}/tools/${tool.id}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    ...demos.map((demo) => ({
      url: `${site.url}/demos/${demo.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

export type ToolKind = "ai" | "browser";

export type ToolItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  kind: ToolKind;
  icon: string;
};

const groups: Array<{ category: string; kind: ToolKind; items: string }> = [
  { category: "Writing & Documents", kind: "ai", items: "Chat With PDF|Long-Document Summarizer|Grammar and Clarity Checker|Email and Follow-up Writer|Meeting Notes to Action Items|Invoice and Receipt Data Extractor" },
  { category: "Career", kind: "ai", items: "Resume Builder|Resume-to-Job Matcher" },
  { category: "Business", kind: "ai", items: "Spreadsheet AI Analyst|Lead Qualification Assistant|AI Customer Support Reply Generator|Website SEO Auditor" },
  { category: "Creators & Marketing", kind: "ai", items: "Content Repurposing Studio|YouTube Packaging Assistant|Product Description Generator" },
  { category: "Developer & Automation", kind: "ai", items: "Workflow Generator from Plain English|Code Explainer and Debugger" },
  { category: "Data & Text Utilities", kind: "browser", items: "JSON Formatter and Validator|CSV Cleaner|CSV to JSON Converter|JSON to CSV Converter|Word and Character Counter|Text Diff Checker|URL Encoder and Decoder|Timestamp Converter|Profit Margin Calculator|UTM Link Builder" },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const categoryIcons: Record<string, string> = {
  "Writing & Documents": "file-text",
  Career: "target",
  Business: "briefcase-business",
  "Creators & Marketing": "clapperboard",
  "Developer & Automation": "workflow",
  "Data & Text Utilities": "code",
};

export const toolCatalog: ToolItem[] = groups.flatMap((group) =>
  group.items.split("|").map((name) => ({
    id: slugify(name),
    name,
    category: group.category,
    kind: group.kind,
    icon: categoryIcons[group.category] ?? "sparkles",
    description: group.kind === "browser"
      ? "Runs locally in your browser for quick, private utility tasks."
      : "A focused AI assistant that works with the context you provide and produces a practical result.",
  })),
);

export const browserToolIds = new Set([
  "json-formatter-and-validator",
  "csv-cleaner",
  "csv-to-json-converter",
  "json-to-csv-converter",
  "word-and-character-counter",
  "text-diff-checker",
  "url-encoder-and-decoder",
  "timestamp-converter",
  "profit-margin-calculator",
  "utm-link-builder",
]);

export function findTool(id: string) {
  return toolCatalog.find((tool) => tool.id === id);
}

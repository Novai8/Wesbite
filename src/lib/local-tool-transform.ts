"use client";

import type { ToolItem } from "@/data/tool-catalog";

export function localTransform(tool: ToolItem, input: string): string | null {
  const value = input.trim();
  switch (tool.id) {
    case "json-formatter-and-validator":
      try { return JSON.stringify(JSON.parse(value), null, 2); }
      catch (error) { return "Invalid JSON: " + (error instanceof Error ? error.message : "Check commas, quotes, and brackets."); }
    case "csv-cleaner": {
      const rows = value.split(/\r?\n/).filter(Boolean).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
      if (!rows.length) return "Paste CSV rows to clean.";
      const seen = new Set<string>();
      const cleaned = rows.filter((row) => {
        const key = row.join("\u0000");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((row) => row.map((cell) => /[",\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell).join(","));
      return cleaned.join("\n");
    }
    case "csv-to-json-converter": {
      const rows = value.split(/\r?\n/).filter(Boolean).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
      if (rows.length < 2) return "Add a CSV header row followed by at least one data row.";
      const headers = rows[0];
      return JSON.stringify(rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2);
    }
    case "json-to-csv-converter": {
      try {
        const data = JSON.parse(value);
        if (!Array.isArray(data) || !data.length || typeof data[0] !== "object" || data[0] === null) return "Provide a non-empty JSON array of objects.";
        const headers = Array.from(new Set(data.flatMap((row: Record<string, unknown>) => Object.keys(row))));
        const quote = (cell: unknown) => '"' + String(cell ?? "").replace(/"/g, '""') + '"';
        return [headers.map(quote).join(","), ...data.map((row: Record<string, unknown>) => headers.map((key) => quote(row[key])).join(","))].join("\n");
      } catch { return "Invalid JSON. Paste a JSON array of objects."; }
    }
    case "word-and-character-counter": {
      const words = value ? value.split(/\s+/).filter(Boolean).length : 0;
      const sentences = value ? (value.match(/[.!?]+(?=\s|$)/g) || []).length : 0;
      const paragraphs = value ? value.split(/\n\s*\n/).filter((item) => item.trim()).length : 0;
      return "Words: " + words + "\nCharacters (with spaces): " + input.length + "\nCharacters (without spaces): " + input.replace(/\s/g, "").length + "\nSentences: " + sentences + "\nParagraphs: " + paragraphs;
    }
    case "text-case-converter":
      return "UPPERCASE\n" + value.toUpperCase() + "\n\nlowercase\n" + value.toLowerCase() + "\n\nTitle Case\n" + value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) + "\n\nSentence case\n" + value.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (char) => char.toUpperCase());
    case "text-diff-checker": {
      const parts = input.split(/\n---\s*\n/);
      if (parts.length < 2) return "Paste version one, then a line containing --- and version two.";
      const a = parts[0].split("\n");
      const b = parts.slice(1).join("\n").split("\n");
      const out = ["COMPARISON", ""];
      a.forEach((line, index) => { if (line !== b[index]) out.push("- " + line); });
      b.forEach((line, index) => { if (line !== a[index]) out.push("+ " + line); });
      if (out.length === 2) out.push("No line-level differences found.");
      return out.join("\n");
    }
    case "base64-encoder-and-decoder":
      try {
        if (value.startsWith("decode:")) return decodeURIComponent(escape(atob(value.slice(7).trim())));
        return btoa(unescape(encodeURIComponent(value)));
      } catch { return "Could not decode that Base64 value. For decoding, start the input with decode:"; }
    case "url-encoder-and-decoder":
      try { return value.startsWith("decode:") ? decodeURIComponent(value.slice(7).trim()) : encodeURIComponent(value); }
      catch { return "Invalid encoded URL component."; }
    case "uuid-generator":
      return Array.from({ length: Math.min(20, Math.max(1, Number(value) || 1)) }, () => crypto.randomUUID()).join("\n");
    case "markdown-previewer":
      return "Markdown preview is represented as plain text here. Use headings (#), lists (-), **bold**, and links [label](url).\n\n" + value;
    case "html-entity-encoder":
      return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    case "timestamp-converter": {
      const number = Number(value);
      if (!Number.isFinite(number)) return "Enter a Unix timestamp in seconds or milliseconds.";
      const milliseconds = Math.abs(number) < 1e12 ? number * 1000 : number;
      const date = new Date(milliseconds);
      return Number.isNaN(date.getTime()) ? "That timestamp is outside the supported range." : date.toISOString() + "\nLocal display: " + date.toLocaleString();
    }
    case "percentage-calculator": {
      const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length < 2) return "Enter two numbers, for example: 18, 240. This calculates the first as a percentage of the second.";
      return nums[1] === 0 ? "Cannot divide by zero." : nums[0] + " is " + ((nums[0] / nums[1]) * 100).toFixed(2) + "% of " + nums[1] + ".";
    }
    case "profit-margin-calculator": {
      const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length < 2) return "Enter selling price and cost, e.g. 100, 65.";
      const [selling, cost] = nums;
      if (selling === 0) return "Selling price must not be zero.";
      return "Profit: " + (selling - cost).toFixed(2) + "\nGross margin: " + (((selling - cost) / selling) * 100).toFixed(2) + "%\nMarkup on cost: " + (cost === 0 ? "Not defined when cost is zero." : (((selling - cost) / cost) * 100).toFixed(2) + "%");
    }
    case "utm-link-builder": {
      try {
        const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
        const url = new URL(lines[0]);
        const params = new URLSearchParams(url.search);
        for (const line of lines.slice(1)) {
          const [key, ...rest] = line.split("=");
          if (key && rest.length) params.set("utm_" + key.trim().replace(/^utm_/, ""), rest.join("=").trim());
        }
        url.search = params.toString();
        return url.toString();
      } catch { return "Enter a full URL on the first line, then source=..., medium=..., campaign=... on separate lines."; }
    }
    case "password-generator": {
      const length = Math.min(128, Math.max(12, Number(value) || 20));
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_";
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
    }
    case "text-duplicate-remover":
      return Array.from(new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))).join("\n");
    default:
      return null;
  }
}

import { type ReactNode } from "react";

function splitTableRow(line: string) {
  const cleaned = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return cleaned.split("|").map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function isTableStart(lines: string[], index: number) {
  return index + 1 < lines.length && lines[index].includes("|") && lines[index + 1].includes("|") && isTableDivider(lines[index + 1]);
}

function isListLine(line: string) {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  return (
    /^#{1,4}\s+/.test(line) ||
    /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*`{3,}/.test(line) ||
    isListLine(line) ||
    isTableStart(lines, index)
  );
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\))/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > cursor) result.push(text.slice(cursor, start));

    const key = keyPrefix + "-inline-" + tokenIndex++;
    if (token.startsWith("**") || token.startsWith("__")) {
      result.push(<strong key={key}>{parseInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("~~")) {
      result.push(<del key={key}>{parseInline(token.slice(2, -2), key)}</del>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      result.push(<em key={key}>{parseInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith("`")) {
      result.push(<code key={key} className="rg-md-inline-code">{token.slice(1, -1)}</code>);
    } else {
      const separator = token.indexOf("](");
      const label = token.slice(1, separator);
      const href = token.slice(separator + 2, -1);
      const external = href.startsWith("http://") || href.startsWith("https://");
      result.push(
        <a
          key={key}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {parseInline(label, key)}
        </a>
      );
    }
    cursor = start + token.length;
  }

  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

function renderBlocks(lines: string[], keyPrefix: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const key = keyPrefix + "-block-" + blocks.length;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*`{3,}/.test(line)) {
      const language = line.trim().replace(/^`{3,}/, "").trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*`{3,}/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <div className="rg-md-code-block" key={key}>
          {language && <span className="rg-md-code-label">{language}</span>}
          <pre><code>{codeLines.join("\n")}</code></pre>
        </div>
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = parseInline(heading[2].trim(), key);
      if (level === 1) blocks.push(<h3 key={key}>{content}</h3>);
      else if (level === 2) blocks.push(<h4 key={key}>{content}</h4>);
      else if (level === 3) blocks.push(<h5 key={key}>{content}</h5>);
      else blocks.push(<h6 key={key}>{content}</h6>);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={key} />);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={key}>{renderBlocks(quoteLines, key)}</blockquote>);
      continue;
    }

    if (isTableStart(lines, index)) {
      const headings = splitTableRow(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="rg-md-table-wrap" key={key} role="region" aria-label="Response table" tabIndex={0}>
          <table className="rg-md-table">
            <thead>
              <tr>
                {headings.map((cell, cellIndex) => (
                  <th key={key + "-head-" + cellIndex}>{parseInline(cell, key + "-head-" + cellIndex)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={key + "-row-" + rowIndex}>
                  {headings.map((_, cellIndex) => (
                    <td key={key + "-cell-" + rowIndex + "-" + cellIndex}>
                      {parseInline(row[cellIndex] ?? "", key + "-cell-" + rowIndex + "-" + cellIndex)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      const listPattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (index < lines.length && listPattern.test(lines[index])) {
        items.push(lines[index].match(listPattern)?.[1] ?? "");
        index += 1;
      }
      const listItems = items.map((item, itemIndex) => (
        <li key={key + "-item-" + itemIndex}>{parseInline(item, key + "-item-" + itemIndex)}</li>
      ));
      blocks.push(ordered ? <ol key={key}>{listItems}</ol> : <ul key={key}>{listItems}</ul>);
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={key}>{parseInline(paragraphLines.join(" "), key)}</p>);
  }

  return blocks;
}

export function AssistantMessageContent({ content }: { content: string }) {
  const normalized = content.replace(/\r\n?/g, "\n").trim();
  return (
    <div className="rg-assistant-markdown">
      {renderBlocks(normalized.split("\n"), "assistant-md")}
    </div>
  );
}

import type { LegalDocumentId } from './documents';
export type LegalBlock =
  | { kind: 'heading'; text: string; level: number; id: string }
  | { kind: 'text' | 'quote'; text: string }
  | { kind: 'item'; text: string; marker: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] };
export const legalHeadingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
/** Supports the headings, lists, tables and quotations in the supplied policies; never executes HTML. */
export function legalBlocks(markdown: string): LegalBlock[] {
  const lines = markdown.split('\n');
  const blocks: LegalBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const heading = line.match(/^(#{1,6}) (.+)$/);
    const item = line.match(/^(-|\d+\.) (.+)$/);
    if (heading)
      blocks.push({
        kind: 'heading',
        text: heading[2],
        level: heading[1].length,
        id: legalHeadingId(heading[2]),
      });
    else if (line === '---') blocks.push({ kind: 'rule' });
    else if (item)
      blocks.push({ kind: 'item', marker: item[1] === '-' ? '•' : item[1], text: item[2] });
    else if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i++]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) rows.push(cells);
      }
      i--;
      blocks.push({ kind: 'table', rows });
    } else if (line.startsWith('> ')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('> '))
        quote.push(lines[i++].slice(2).replace(/\\$/, ''));
      i--;
      blocks.push({ kind: 'quote', text: quote.join('\n') });
    } else {
      const paragraph = [line];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        !/^(#|>|\||- |\d+\. |---)/.test(lines[i + 1])
      )
        paragraph.push(lines[++i]);
      blocks.push({ kind: 'text', text: paragraph.join('\n') });
    }
  }
  return blocks;
}
export function legalLink(
  href: string,
  current: LegalDocumentId,
): { documentId: LegalDocumentId; anchor: string } | undefined {
  if (href.startsWith('#')) return { documentId: current, anchor: href.slice(1) };
  const match = href.match(
    /^(?:https:\/\/vocespace\.com)?\/(?:legal\/)?(privacy|terms)\/?(?:#(.*))?$/,
  );
  if (match) return { documentId: match[1] as LegalDocumentId, anchor: match[2] || '' };
  return undefined;
}
export function legalAnchor(anchor: string) {
  return anchor === 'delete-account' ? '10-deleting-your-vocespace-account' : anchor;
}

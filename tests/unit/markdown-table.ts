/** Rows of the first markdown table after a line that starts with `heading`, as trimmed cells with backticks removed. */
export function tableAfter(markdown: string, heading: string): string[][] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) throw new Error(`No line starts with "${heading}"`);
  const rows: string[][] = [];
  let seenTable = false;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('|')) {
      seenTable = true;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll('`', ''));
      const isDivider = cells.every((cell) => /^-+$/.test(cell));
      if (!isDivider) rows.push(cells);
    } else if (seenTable) {
      break;
    }
  }
  return rows.slice(1);
}

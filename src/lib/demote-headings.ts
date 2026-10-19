/**
 * A case's body is written with `##` headings. On the case page it sits inside a section whose own
 * heading is an h2, so its headings render one level lower: h2 becomes h3. Used by the Markdown
 * processor in astro.config.ts.
 */
export const demotedHeadings = ['h1', 'h2', 'h3', 'h4', 'h5'] as const;

/** The tag one heading level below: h2 gives h3. An h6, or any other tag, is returned as it is. */
export function lowerHeading(tagName: string): string {
  const level = /^h([1-5])$/.exec(tagName)?.[1];
  return level === undefined ? tagName : `h${String(Number(level) + 1)}`;
}

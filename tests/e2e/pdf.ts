/**
 * The number of pages in a PDF, counted from its page objects (`/Type /Page`, not the
 * `/Type /Pages` tree). Chromium writes page objects uncompressed, so a plain scan reads them.
 */
export function pdfPageCount(pdf: Buffer): number {
  return [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page(?![A-Za-z])/g)].length;
}

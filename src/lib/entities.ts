/**
 * HTML character references as the characters they stand for: numbers, the Latin-1 letters by
 * name (&eacute;, &Atilde;), and the punctuation pages use. Names keep their case, since &Eacute;
 * and &eacute; are different letters. An unknown name is left as it is. One home for the page
 * text the desk reads (sentences.ts), checks quotes against (quotes.ts) and takes facts from
 * (page-facts.ts). Pure.
 */

const latin1Letters =
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';

const named: Record<string, string> = {
  // Latin-1 letters run from code point 192 (À) to 255 (ÿ), in this order.
  ...Object.fromEntries(latin1Letters.split(' ').map((name, index) => [name, String.fromCodePoint(192 + index)])),
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', bdquo: '„', sbquo: '‚',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•', deg: '°', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™',
  iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª', OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name: string) => named[name] ?? named[name.toLowerCase()] ?? whole);
}

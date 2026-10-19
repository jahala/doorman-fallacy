import { builtRoutes, expect, fileForPath, htmlFileForRoute, readBuilt, test } from './site.ts';
import { notYetBuiltAnchors, notYetBuiltRoutes } from './not-yet-built.ts';

interface Reference {
  readonly from: string;
  readonly target: string;
}

const schemePattern = /^[a-z][a-z0-9+.-]*:/i;

function decode(attribute: string): string {
  return attribute.replaceAll('&amp;', '&');
}

/** Internal href, src and srcset targets in one built page, as absolute site paths with any query removed. */
function internalReferences(route: string): Reference[] {
  const html = readBuilt(htmlFileForRoute(route));
  const raw: string[] = [];
  for (const match of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) raw.push(match[1] ?? '');
  for (const match of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const candidate of (match[1] ?? '').split(',')) raw.push(candidate.trim().split(/\s+/)[0] ?? '');
  }
  return raw
    .map(decode)
    .filter((value) => value !== '' && !value.startsWith('//') && !schemePattern.test(value))
    .map((value) => {
      const resolved = new URL(value, `http://site.test${route}`);
      return { from: route, target: resolved.pathname + resolved.hash };
    });
}

function anchorsIn(file: string): Set<string> {
  return new Set([...readBuilt(file).matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? ''));
}

const routes = builtRoutes();
const references = routes.flatMap(internalReferences);

test('every internal link and asset resolves to a file in dist', () => {
  const broken = references.filter(({ target }) => {
    const pathname = target.split('#')[0] ?? '';
    return fileForPath(pathname) === undefined && !notYetBuiltRoutes.includes(pathname);
  });
  expect(broken).toEqual([]);
});

test('every in-page anchor exists on its page', () => {
  const broken = references.filter(({ target }) => {
    const [pathname = '', fragment] = target.split('#');
    if (fragment === undefined || fragment === '') return false;
    if (notYetBuiltAnchors.includes(target)) return false;
    const file = fileForPath(pathname);
    return file === undefined || !anchorsIn(file).has(fragment);
  });
  expect(broken).toEqual([]);
});

test('the not-yet-built lists only name pages that are still missing', () => {
  const built = notYetBuiltRoutes.filter((route) => fileForPath(route) !== undefined);
  expect(built).toEqual([]);
  const anchored = notYetBuiltAnchors.filter((target) => {
    const [pathname = '', fragment = ''] = target.split('#');
    const file = fileForPath(pathname);
    return file !== undefined && anchorsIn(file).has(fragment);
  });
  expect(anchored).toEqual([]);
});

test('the not-yet-built lists are all in use, so none lingers after its link goes', () => {
  const targets = new Set(references.map(({ target }) => target));
  const unused = [
    ...notYetBuiltRoutes.filter((route) => !references.some(({ target }) => target.split('#')[0] === route)),
    ...notYetBuiltAnchors.filter((anchor) => !targets.has(anchor)),
  ];
  expect(unused).toEqual([]);
});

/** Pages that answer a form, or that a form links to for one case, are for people who just acted. */
function answersAForm(route: string): boolean {
  return /^\/(subscribe\/|suggest\/(thanks|problem|error)\/)/.test(route);
}

test('no page links to the specimen, and only the specimen and the form answers ask search engines to skip them', () => {
  const toSpecimen = references.filter(({ from, target }) => from !== '/specimen/' && target.startsWith('/specimen'));
  expect(toSpecimen).toEqual([]);
  const noindex = routes.filter((route) => /<meta name="robots" content="noindex"/.test(readBuilt(htmlFileForRoute(route))));
  expect(noindex.filter((route) => route !== '/specimen/' && !answersAForm(route))).toEqual([]);
  expect(noindex).toContain('/specimen/');
  const indexed = routes.filter((route) => answersAForm(route) && !noindex.includes(route));
  expect(indexed).toEqual([]);
});

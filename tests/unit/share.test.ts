import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { definition } from '../../src/data/definition.ts';
import {
  caseCard,
  cardElement,
  cardSize,
  cardTitleSize,
  ogPath,
  shareImage,
  siteCard,
  type CardChild,
} from '../../src/lib/share.ts';
import { schemePalette } from '../../src/lib/tokens.ts';
import { caseEntry } from './fixture-case.ts';

const tokensCss = readFileSync(path.resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');
const palette = schemePalette(tokensCss, 'light');
if (palette === undefined) throw new Error('tokens.css has no light palette');

/** Every node in a card's tree, the root first. */
function nodes(child: CardChild): Exclude<CardChild, string>[] {
  if (typeof child === 'string') return [];
  const { children } = child.props;
  const below = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return [child, ...below.flatMap(nodes)];
}

/** The words a card shows, in reading order. */
function texts(child: CardChild): string[] {
  if (typeof child === 'string') return [child];
  const { children } = child.props;
  const below = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return below.flatMap(texts);
}

describe('the cards', () => {
  it('has the site card say the definition from its data file, with the credit to Sutherland', () => {
    const card = siteCard();
    expect(card.title).toBe('The doorman fallacy');
    expect(card.line).toBe(definition);
    expect(card.kicker).toContain('Rory Sutherland');
    expect(card.status).toBeNull();
  });

  it('has a case card show the short name, the change and the current status as a word', () => {
    const entry = caseEntry('example-2025', { short: 'Example Bank', status: 'reversed' });
    expect(caseCard(entry)).toEqual({
      kicker: 'Australia · Customer service',
      title: 'Example Bank',
      line: '45 roles cut for a voice bot.',
      status: 'Reversed',
    });
  });
});

describe('ogPath', () => {
  it('names the site image and one image per case', () => {
    expect(ogPath.site).toBe('/og/default.png');
    expect(ogPath.ledger('dnb-2026')).toBe('/og/ledger/dnb-2026.png');
  });
});

describe('shareImage', () => {
  it('gives the path, the size every card has, and alt text that reads what the card says', () => {
    const image = shareImage(caseCard(caseEntry('example-2025', { short: 'Example Bank', status: 'reversed' })), ogPath.ledger('example-2025'));
    expect(image).toEqual({
      path: '/og/ledger/example-2025.png',
      width: cardSize.width,
      height: cardSize.height,
      alt: 'Australia · Customer service. Example Bank. 45 roles cut for a voice bot. Reversed.',
    });
  });

  it('is 1200 by 630', () => {
    expect(cardSize).toEqual({ width: 1200, height: 630 });
  });
});

describe('cardTitleSize', () => {
  it('sets short titles large and long ones smaller, so a long company name still fits', () => {
    expect(cardTitleSize('Signal')).toBe(96);
    expect(cardTitleSize('Commonwealth Bank')).toBe(96);
    expect(cardTitleSize('Commonwealth Bank of Australia')).toBe(80);
    expect(cardTitleSize('The Hongkong and Shanghai Banking Corporation')).toBe(64);
  });
});

describe('cardElement', () => {
  const card = caseCard(caseEntry('example-2025', { short: 'Example Bank', status: 'reversed' }));
  const tree = cardElement(card, palette);

  it('is 1200 by 630 on the paper colour', () => {
    expect(tree.props.style).toMatchObject({ width: 1200, height: 630, backgroundColor: palette.paper });
  });

  it('counts its padding inside the 1200 by 630, so the footer is not pushed off the card', () => {
    expect(tree.props.style['boxSizing']).toBe('border-box');
  });

  it('shows the wordmark first, then the kicker, the title, the line and the status', () => {
    const shown = texts(tree);
    expect(shown[0]).toBe('The Doorman Fallacy');
    expect(shown).toEqual(expect.arrayContaining(['Australia · Customer service', 'Example Bank', '45 roles cut for a voice bot.', 'Reversed']));
    expect(shown.indexOf('Example Bank')).toBeLessThan(shown.indexOf('45 roles cut for a voice bot.'));
  });

  it('shows no status on a card that has none', () => {
    expect(texts(cardElement(siteCard(), palette))).not.toContain('Reversed');
  });

  it('has a hairline under the wordmark', () => {
    const rules = nodes(tree).filter((node) => node.props.style['height'] === 1);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]?.props.style['backgroundColor']).toBe(palette.rule);
  });

  it('uses only Prata and Inter', () => {
    const families = new Set(nodes(tree).flatMap((node) => (typeof node.props.style['fontFamily'] === 'string' ? [node.props.style['fontFamily']] : [])));
    expect([...families].sort()).toEqual(['Inter', 'Prata']);
  });

  it('sets the title in Prata and the line in Inter', () => {
    const family = (words: string): unknown => nodes(tree).find((node) => texts(node).join('') === words)?.props.style['fontFamily'];
    expect(family('Example Bank')).toBe('Prata');
    expect(family('45 roles cut for a voice bot.')).toBe('Inter');
  });

  it('takes every colour from the palette and none from anywhere else, and never uses the accent', () => {
    const colours = new Set(
      nodes(tree).flatMap((node) =>
        ['color', 'backgroundColor', 'borderColor'].flatMap((key) => {
          const value = node.props.style[key];
          return typeof value === 'string' ? [value] : [];
        }),
      ),
    );
    const allowed = new Set([palette.paper, palette.ink, palette['ink-2'], palette.rule]);
    expect([...colours].filter((colour) => !allowed.has(colour))).toEqual([]);
    expect(colours.has(palette.accent)).toBe(false);
  });

  it('makes every box with more than one child a flex box, which the renderer requires', () => {
    const bad = nodes(tree).filter((node) => {
      const { children } = node.props;
      return Array.isArray(children) && children.length > 1 && node.props.style['display'] !== 'flex';
    });
    expect(bad).toEqual([]);
  });
});

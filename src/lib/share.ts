import { definition } from '../data/definition.ts';
import { statuses } from '../data/statuses.ts';
import { countryName, type CaseEntry } from './ledger.ts';
import { currentStatus } from './status.ts';
import type { Palette } from './tokens.ts';

/**
 * What a share card says and how it is laid out. Pure: the layout is a plain tree that the
 * renderer in src/og/ turns into a PNG. Docs: design.md, "Share cards".
 */
export const cardSize = { width: 1200, height: 630 } as const;

export interface ShareCard {
  /** The small line above the title. */
  readonly kicker: string;
  readonly title: string;
  /** The line under the title, in the grey text colour. */
  readonly line: string;
  /** A case's current status as a word, or null. */
  readonly status: string | null;
}

/** The site's own card: the definition, with the credit to Sutherland. */
export function siteCard(): ShareCard {
  return { kicker: 'After Rory Sutherland, Alchemy (2019)', title: 'The doorman fallacy', line: definition, status: null };
}

export function caseCard(entry: CaseEntry): ShareCard {
  const { data } = entry;
  return {
    kicker: `${countryName(data.country)} · ${data.area}`,
    title: data.short,
    line: data.change,
    status: statuses[currentStatus(data)].label,
  };
}

/** Where each card is served. */
export const ogPath = {
  site: '/og/default.png',
  ledger: (slug: string): string => `/og/ledger/${slug}.png`,
} as const;

export interface ShareImage {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

/** The image a page names in its head, with alt text that reads what the card says. */
export function shareImage(card: ShareCard, path: string): ShareImage {
  const spoken = [card.kicker, card.title, card.line, card.status ?? ''].filter((part) => part !== '').map((part) => part.replace(/[.!?]$/, ''));
  return { path, ...cardSize, alt: `${spoken.join('. ')}.` };
}

/** Prata is wide: a long title steps down so that it holds to two lines. */
export function cardTitleSize(title: string): number {
  if (title.length <= 18) return 96;
  return title.length <= 30 ? 80 : 64;
}

export interface CardNode {
  readonly type: 'div' | 'span';
  readonly props: {
    readonly style: Readonly<Record<string, string | number>>;
    readonly children?: CardChild | readonly CardChild[];
  };
}

export type CardChild = string | CardNode;

const wordmark = 'The Doorman Fallacy';
const domain = 'thedoormanfallacy.com';

function text(style: Record<string, string | number>, children: string): CardNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

/**
 * The card: paper background, the wordmark and a hairline at the top, then the kicker, the
 * title in Prata and the line in Inter. Only palette colours; no accent. Every box with
 * several children is a flex box, which the renderer requires.
 */
export function cardElement(card: ShareCard, palette: Palette): CardNode {
  const { ink, paper, rule } = palette;
  const grey = palette['ink-2'];
  const footerStyle = { display: 'flex', justifyContent: card.status === null ? 'flex-end' : 'space-between' };
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        width: cardSize.width,
        height: cardSize.height,
        padding: '56px 80px',
        backgroundColor: paper,
        color: ink,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              text({ fontFamily: 'Prata', fontSize: 32, color: ink }, wordmark),
              { type: 'div', props: { style: { display: 'flex', width: '100%', height: 1, marginTop: 24, backgroundColor: rule } } },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              text({ fontFamily: 'Inter', fontSize: 26, color: grey }, card.kicker),
              text({ fontFamily: 'Prata', fontSize: cardTitleSize(card.title), lineHeight: 1.05, marginTop: 20, color: ink }, card.title),
              text({ fontFamily: 'Inter', fontSize: 34, lineHeight: 1.35, marginTop: 28, color: grey }, card.line),
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: footerStyle,
            children:
              card.status === null
                ? [text({ fontFamily: 'Inter', fontSize: 26, color: grey }, domain)]
                : [
                    text({ fontFamily: 'Inter', fontSize: 28, color: grey }, card.status),
                    text({ fontFamily: 'Inter', fontSize: 26, color: grey }, domain),
                  ],
          },
        },
      ],
    },
  };
}

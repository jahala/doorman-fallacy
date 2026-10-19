import type { ImageMetadata } from 'astro';
import heroFile from '../assets/photos/doorman-profile.jpg';
import portraitFile from '../assets/photos/doorman-portrait.jpg';

export interface Photo {
  readonly file: ImageMetadata;
  readonly alt: string;
  readonly caption: string;
  /** Name of the work, when it has one. */
  readonly title?: string;
  readonly place?: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
}

export const photos = {
  hero: {
    file: heroFile,
    alt: 'A doorman in a top hat stands in profile beside clipped shrubs in black planters outside a hotel entrance.',
    caption: 'The visible task is not always the whole job.',
    title: 'The Silent Sentinel',
    place: 'Dublin',
    photographer: 'atelierbyvineeth',
    photographerUrl: 'https://unsplash.com/@atelierbyvineeth',
    photoUrl: 'https://unsplash.com/photos/AJ6Wr1cbkQM',
  },
  portrait: {
    file: portraitFile,
    alt: 'Close portrait of a smiling doorman in a bowler hat, glasses and a dark overcoat.',
    caption: 'The first person a guest meets.',
    photographer: 'Maryam Tello',
    photographerUrl: 'https://unsplash.com/@tellophotography',
    photoUrl: 'https://unsplash.com/photos/zQ25s9r25uM',
  },
} as const satisfies Record<string, Photo>;

export type PhotoId = keyof typeof photos;

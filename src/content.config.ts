import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { caseSchema } from './data/case-schema.ts';

/**
 * Where the case files are read from. The size test and the empty-ledger test point this at a
 * folder of their own; a build for the site never sets it.
 */
const casesFolder = process.env['DOORMAN_CASES_DIR'] ?? './src/content/cases';

const cases = defineCollection({
  loader: glob({ pattern: '*.md', base: casesFolder }),
  schema: caseSchema,
});

export const collections = { cases };

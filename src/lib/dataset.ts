import type { HiddenFunctionId } from '../data/hidden-functions.ts';
import type { StatusId } from '../data/statuses.ts';
import { derivedNextReview } from './review.ts';
import { newestFirst, type CaseEntry } from './ledger.ts';
import { currentStatus, latestUpdate } from './status.ts';

/**
 * The ledger as data, for /ledger.csv and /ledger.json. Every field is a fact of the case or
 * derived from it, so the dataset can never disagree with the pages. Column names are fixed:
 * people build on them. Dates are YYYY-MM-DD. Docs: data-model.md, "The dataset".
 */
export interface DatasetRow {
  readonly slug: string;
  /** The case page, in full. */
  readonly url: string;
  readonly company: string;
  readonly short: string;
  /** ISO 3166 alpha-2 code. */
  readonly country: string;
  readonly area: string;
  readonly change: string;
  readonly announced: string;
  /** Null when the organisation did not state it. */
  readonly headcount: number | null;
  readonly door: string;
  /** The current status id: the status of the latest update. */
  readonly status: StatusId;
  readonly latest_update_date: string;
  readonly latest_update_summary: string;
  /** Hidden function ids the doorman reading names. */
  readonly missed: readonly HiddenFunctionId[];
  readonly last_checked: string;
  /** Derived. Null when the case is closed. */
  readonly next_review: string | null;
  /** How many sources the case lists. */
  readonly sources: number;
}

export const datasetColumns = [
  'slug',
  'url',
  'company',
  'short',
  'country',
  'area',
  'change',
  'announced',
  'headcount',
  'door',
  'status',
  'latest_update_date',
  'latest_update_summary',
  'missed',
  'last_checked',
  'next_review',
  'sources',
] as const satisfies readonly (keyof DatasetRow)[];

export const datasetLicence = 'CC BY 4.0';
export const datasetCredit = 'The Doorman Fallacy, thedoormanfallacy.com';

/** One row per case, newest announcement first. `siteUrl` is the site's address, such as https://thedoormanfallacy.com. */
export function datasetRows(entries: readonly CaseEntry[], siteUrl: string): DatasetRow[] {
  return newestFirst(entries).map(({ id, data }) => {
    const latest = latestUpdate(data);
    return {
      slug: id,
      url: new URL(`/ledger/${id}/`, siteUrl).href,
      company: data.company,
      short: data.short,
      country: data.country,
      area: data.area,
      change: data.change,
      announced: data.announced,
      headcount: data.headcount,
      door: data.door,
      status: currentStatus(data),
      latest_update_date: latest.date,
      latest_update_summary: latest.summary,
      missed: data.missed.map((point) => point.function),
      last_checked: data.lastChecked,
      next_review: derivedNextReview(data),
      sources: data.sources.length,
    };
  });
}

/** One CSV field, quoted when it holds a comma, a quote or a line break (RFC 4180). A quote is doubled. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function cell(row: DatasetRow, column: (typeof datasetColumns)[number]): string {
  const value = row[column];
  if (value === null) return '';
  return csvField(Array.isArray(value) ? value.join(';') : String(value));
}

/** A header row, then one record per case. Records end in CRLF. A missing value is an empty field; a list is joined with semicolons. */
export function toCsv(rows: readonly DatasetRow[]): string {
  const lines = [datasetColumns.join(','), ...rows.map((row) => datasetColumns.map((column) => cell(row, column)).join(','))];
  return `${lines.join('\r\n')}\r\n`;
}

/** The licence and the credit, then the cases. Lists stay lists and a missing value is null. */
export function datasetJson(rows: readonly DatasetRow[]): string {
  return `${JSON.stringify({ licence: datasetLicence, credit: datasetCredit, cases: rows }, null, 2)}\n`;
}

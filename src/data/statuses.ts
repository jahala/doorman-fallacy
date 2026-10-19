/** Case statuses. The schema, the pages and docs/data-model.md all read from this file. */
export const statusIds = [
  'too-early',
  'holding',
  'strained',
  'partly-reversed',
  'reversed',
] as const;

export type StatusId = (typeof statusIds)[number];

export interface StatusEntry {
  readonly label: string;
  readonly meaning: string;
}

export const statuses: Readonly<Record<StatusId, StatusEntry>> = {
  'too-early': {
    label: 'Too early to tell',
    meaning: 'The cut is recent, or nothing has been reported since',
  },
  holding: {
    label: 'Holding',
    meaning: 'Reports say the change works as intended',
  },
  strained: {
    label: 'Strained',
    meaning: 'Reports of problems: complaints, overtime, quality falling',
  },
  'partly-reversed': {
    label: 'Partly reversed',
    meaning: 'Some roles or human options restored',
  },
  reversed: {
    label: 'Reversed',
    meaning: 'The company undid the cut',
  },
};

/** The work an automated task leaves behind. Read by the schema, the pages and docs/data-model.md. */
export const hiddenFunctionIds = [
  'signal',
  'deterrence',
  'judgment',
  'memory',
  'absorption',
  'slack',
] as const;

export type HiddenFunctionId = (typeof hiddenFunctionIds)[number];

export interface HiddenFunctionEntry {
  readonly label: string;
  readonly meaning: string;
}

export const hiddenFunctions: Readonly<Record<HiddenFunctionId, HiddenFunctionEntry>> = {
  signal: {
    label: 'Signal',
    meaning: "A person's presence tells customers they matter",
  },
  deterrence: {
    label: 'Deterrence',
    meaning: 'A person watching changes behaviour',
  },
  judgment: {
    label: 'Judgment',
    meaning: 'Spotting the case the script does not cover, and escalating it',
  },
  memory: {
    label: 'Memory',
    meaning: 'Knowing the regular, the history, the exception',
  },
  absorption: {
    label: 'Absorption',
    meaning: 'Taking anger or confusion so it does not land elsewhere',
  },
  slack: {
    label: 'Slack',
    meaning: 'Spare capacity that only shows in a crisis',
  },
};

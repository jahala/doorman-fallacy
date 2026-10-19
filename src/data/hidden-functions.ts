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
  /** What this work looks like at the hotel door, in Sutherland's example. */
  readonly atTheHotel: string;
  /** What it looks like in a present-day role that AI is asked to take over. Illustrative, not a reported case. */
  readonly today: string;
  /** How its loss tends to show, and where. */
  readonly whenMissing: string;
  /** The question a manager should answer before the change. */
  readonly ask: string;
}

export const hiddenFunctions: Readonly<Record<HiddenFunctionId, HiddenFunctionEntry>> = {
  signal: {
    label: 'Signal',
    meaning: "A person's presence tells customers they matter",
    atTheHotel: 'A doorman tells every arriving guest that this is a place that looks after people. That is part of what the room rate pays for.',
    today: 'A customer who reaches a person at the bank on a bad day feels the bank cares. A chatbot can answer the same question correctly and still leave them feeling processed.',
    whenMissing: 'Slowly, as loyalty and willingness to pay drift down. No single number in the month after the change shows it.',
    ask: 'Which customers choose us partly because a person is there, and how would we know if they stopped?',
  },
  deterrence: {
    label: 'Deterrence',
    meaning: 'A person watching changes behaviour',
    atTheHotel: 'A person at the door changes who tries to walk in, without ever stopping anyone.',
    today: 'An assistant on the shop floor, or a person who reviews claims, makes theft or a false claim less tempting just by being there.',
    whenMissing: 'As higher losses, often in another budget line, where nobody connects them to the change.',
    ask: 'What does nobody try today because a person might notice?',
  },
  judgment: {
    label: 'Judgment',
    meaning: 'Spotting the case the script does not cover, and escalating it',
    atTheHotel: 'The doorman decides when to bend a rule for a regular guest, and when to call security.',
    today: 'A support agent notices that ten routine calls are the same fault and raises it. A claims handler sees the case the policy never foresaw.',
    whenMissing: 'As exceptions that fall through, repeat contacts, and problems found late, or as hard cases piling up on the few people left.',
    ask: 'Who owns the cases the system cannot handle, and how will they find out about them?',
  },
  memory: {
    label: 'Memory',
    meaning: 'Knowing the regular, the history, the exception',
    atTheHotel: "The doorman knows the regular guest's name, and which taxi company to avoid.",
    today: "The long-serving adviser knows a customer's history, and why a process has the odd step it has.",
    whenMissing: 'As knowledge that leaves with the people. New staff and new systems repeat old mistakes.',
    ask: 'What do the people in this role know that is written down nowhere, and where will it live afterwards?',
  },
  absorption: {
    label: 'Absorption',
    meaning: 'Taking anger or confusion so it does not land elsewhere',
    atTheHotel: 'The doorman calms the guest whose room is not ready before they reach the desk.',
    today: 'A call-centre agent takes the anger of a customer whose payment failed, so it does not reach social media or the complaints team.',
    whenMissing: 'As anger that moves elsewhere: to other channels, to the staff who remain, or to the brand.',
    ask: 'Where will the frustration this role takes in go after the change?',
  },
  slack: {
    label: 'Slack',
    meaning: 'Spare capacity that only shows in a crisis',
    atTheHotel: 'In a storm, the doorman finds umbrellas, taxis and help.',
    today: 'A support team that can take a sudden spike of calls during an outage, or cover for sick colleagues.',
    whenMissing: 'On the worst day rather than a normal one. The system copes with an ordinary week and fails when it matters most.',
    ask: 'What happens on our worst day, and who absorbs it?',
  },
};

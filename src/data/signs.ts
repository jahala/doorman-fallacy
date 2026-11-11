/** A sign to watch for, with a line of detail. */
export interface Sign {
  readonly title: string;
  readonly detail: string;
}

/** What to watch after an organisation announces AI-linked cuts: the signs that hidden work went missing. Read by /ledger. */
export const afterSigns: readonly Sign[] = [
  {
    title: 'Complaints rise, or move somewhere new.',
    detail: 'To regulators, ombudsmen, social media or the press, where the organisation counts them as something else.',
  },
  {
    title: 'Customers come back about the same problem.',
    detail: 'Repeat contacts show answers that closed a conversation without solving it.',
  },
  {
    title: 'The people who stayed report more pressure, or leave.',
    detail: 'The hardest cases have to land somewhere. Turnover among them is the cost arriving.',
  },
  {
    title: 'The organisation hires again.',
    detail: 'For similar roles, offshore, through contractors, or under a new title.',
  },
  {
    title: 'A regulator, ombudsman or union raises concerns.',
    detail: 'About service, about how decisions are made, or about how the change itself was made.',
  },
  {
    title: 'The measure that justified the change goes quiet.',
    detail: 'It stops being reported, or is replaced by another one.',
  },
];

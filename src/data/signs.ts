/** Signs that a decision is making the doorman fallacy. Read by /idea and the home page. */
export interface Sign {
  readonly title: string;
  readonly detail: string;
}

export const signs: readonly Sign[] = [
  {
    title: 'The role is described by one task.',
    detail: '"Answers customer enquiries" or "opens the door". The description is what the plan replaces.',
  },
  {
    title: 'The savings are counted on that task alone.',
    detail: 'Cost per contact, tickets closed, handling time. Nothing in the business case counts what else the person did.',
  },
  {
    title: 'Nobody asked the people in the role.',
    detail: 'The plan was made from the job description and the numbers, not from the people who do the job.',
  },
  {
    title: 'Success is measured by the number that justified the change.',
    detail: 'If the measure after the change is the same one that made the case, it cannot show what was lost.',
  },
  {
    title: 'The exceptions have no owner.',
    detail: 'The system handles the usual case. Nobody is named for the unusual one, or for telling anyone it happened.',
  },
  {
    title: 'The cost turns up somewhere else.',
    detail: 'In another team, in complaints, in customers who leave, months later. Each is counted, just not against the change.',
  },
];

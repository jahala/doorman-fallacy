/**
 * The questions Jev answers for each lead, and how the answers are read. The inclusion rule
 * is the one in docs/data-model.md ("What counts as a case"). Code supplies the candidate
 * organisation names and headcounts; Jev only selects among them.
 */
import { companyCandidates, headcountCandidates, headcountValue, sizeBucket, type Lead, type SizeBucket } from '../src/lib/leads.ts';
import type { JevAnswer } from './jev.ts';

export const kinds = {
  new_cut:
    'A named organisation has announced or carried out a reduction of roles (layoffs, redundancies, contracts ended, roles left unfilled on purpose), and the item links it to AI or automation.',
  planned_cut:
    'A named organisation says it will reduce roles in future because of AI or automation, but no reduction has happened yet.',
  reversal:
    'A named organisation rehires people, reverses a cut, or brings back human staff after a reduction that had been linked to AI.',
  aftermath:
    'Problems or effects after an AI-linked reduction at a named organisation: complaints, service failures, union action, legal challenges.',
  trend: 'AI and jobs in general: many organisations, statistics, surveys or studies, with no single organisation’s reduction at its centre.',
  opinion: 'Commentary, interviews, advice, explainers or forecasts.',
  unrelated: 'Not about roles being reduced in connection with AI or automation.',
} as const;

export type Kind = keyof typeof kinds;

/** How AI relates to the cut roles. Only "replaces_work" can be a doorman fallacy: AI has to take over the visible task. */
export const mechanisms = {
  replaces_work:
    'AI or automation now does work the cut roles used to do: a chatbot answering customers, software writing or translating content, AI screening applications or reviewing claims.',
  funds_ai:
    'Roles are cut to save money for AI investment, or in a restructuring towards AI, without AI taking over those roles’ own work.',
  vague: 'AI is given as a reason, or credited with productivity, but the item does not say whether AI does the cut roles’ work.',
  not_applicable: 'The item reports no AI-linked reduction of roles.',
} as const;

/** Which roles were cut. Roles that deal with people carry the most hidden work. */
export const roleTypes = {
  public_facing:
    'Roles dealing directly with customers, patients, students, passengers, readers or the public: customer service, call centres, front desk, sales floor, care, teaching.',
  internal_service: 'Roles serving colleagues inside the organisation: HR, recruiting, IT help desk, internal support.',
  creative_editorial: 'Writers, editors, journalists, translators, designers, illustrators, content moderators.',
  technical: 'Software engineers, data scientists, IT operations.',
  back_office: 'Processing roles with little contact with people: data entry, claims processing, accounts, logistics administration.',
  management: 'Managers and middle management layers.',
  mixed_or_unknown: 'Several kinds of roles, or the item does not say which roles.',
} as const;

export type Mechanism = keyof typeof mechanisms;
export type RoleType = keyof typeof roleTypes;

const none = 'none of these';

export function leadState(lead: Lead): Record<string, string> {
  return { headline: lead.title, outlet: lead.outlet, published: lead.published, ...(lead.snippet === '' ? {} : { summary: lead.snippet }) };
}

export function triageQuestions(lead: Lead): Record<string, unknown> {
  const text = `${lead.title} ${lead.snippet}`;
  const companies = companyCandidates(text);
  const counts = headcountCandidates(text);
  return {
    is_case: {
      type: 'noul',
      instructions: {
        question:
          'Does the news item in the state report that one specific, named organisation has reduced its workforce, or will reduce it, and that the organisation or the report links the reduction to AI or automation?',
        reductions_that_count: 'layoffs, redundancies, job cuts, contracts ended, roles deliberately not refilled, a hiring freeze tied to AI, rehiring after such a cut',
        does_not_count: [
          'a forecast, survey or study about jobs in general',
          'commentary or an interview without a specific organisation’s reduction',
          'AI investment or hiring news without job reductions',
          'a reduction that the item does not connect to AI or automation',
        ],
      },
      criteria: {
        true: 'A named organisation and an AI-linked reduction (or its reversal) are both in the item.',
        false: 'No named organisation, no reduction, or no link to AI or automation.',
      },
    },
    kind: { type: 'choice', instructions: 'What kind of news item is this?', criteria: kinds },
    mechanism: {
      type: 'choice',
      instructions: 'According to the item, how does AI or automation relate to the roles that were cut?',
      criteria: mechanisms,
    },
    role_type: {
      type: 'choice',
      instructions: 'Which kind of roles were cut, according to the item?',
      criteria: roleTypes,
    },
    who_links_ai: {
      type: 'choice',
      instructions: 'Who connects the reduction of roles to AI or automation in this item?',
      criteria: {
        organisation: 'The organisation itself, for example in an announcement, memo or statement by its leaders.',
        others: 'The reporter, analysts, unions, former staff or other outsiders, not the organisation.',
        not_applicable: 'The item reports no reduction of roles linked to AI.',
      },
    },
    company: {
      type: 'choice',
      instructions: {
        question: 'Which of these is the organisation whose workforce the news item is about?',
        note: `Choose "${none}" when the item names no single organisation, or the right name is not in the list.`,
      },
      criteria: Object.fromEntries([...companies, none].map((name) => [name, null])),
    },
    headcount: {
      type: 'choice',
      instructions: {
        question: 'Which of these numbers, as written in the item, is the number of roles or people being cut, rehired or affected?',
        note: `Choose "${none}" when no number of roles is given.`,
      },
      criteria: Object.fromEntries([...counts, none].map((value) => [value, null])),
    },
  };
}

export interface Triage {
  readonly isCase: number;
  readonly kind: Kind;
  readonly kindConfidence: number;
  readonly mechanism: Mechanism;
  readonly roleType: RoleType;
  readonly whoLinksAi: string;
  readonly company: string | null;
  readonly headcount: number | null;
  readonly size: SizeBucket;
}

export function readTriage(answers: Record<string, JevAnswer>): Triage | null {
  const { is_case: isCase, kind, mechanism, role_type: roleType, who_links_ai: who, company, headcount } = answers;
  if (
    isCase?.type !== 'noul' ||
    kind?.type !== 'choice' ||
    mechanism?.type !== 'choice' ||
    roleType?.type !== 'choice' ||
    who?.type !== 'choice' ||
    company?.type !== 'choice' ||
    headcount?.type !== 'choice'
  ) {
    return null;
  }
  const count = headcount.choice === none ? null : headcountValue(headcount.choice);
  return {
    isCase: isCase.noul,
    kind: kind.choice as Kind,
    kindConfidence: kind.confidence,
    mechanism: mechanism.choice as Mechanism,
    roleType: roleType.choice as RoleType,
    whoLinksAi: who.choice,
    company: company.choice === none ? null : company.choice,
    headcount: count,
    size: sizeBucket(count),
  };
}

/**
 * How promising a lead is as a doorman-fallacy case, from 0 to 1. Policy lives here in code,
 * so the weights can change without asking Jev again. A case needs AI doing the roles' work;
 * roles that deal with people carry the most hidden work; reversals and aftermath are the
 * follow-up the ledger exists for.
 */
export const mechanismWeight: Record<Mechanism, number> = { replaces_work: 1, vague: 0.5, funds_ai: 0.15, not_applicable: 0 };
export const roleWeight: Record<RoleType, number> = {
  public_facing: 1,
  internal_service: 0.8,
  creative_editorial: 0.8,
  mixed_or_unknown: 0.6,
  back_office: 0.5,
  technical: 0.4,
  management: 0.4,
};
export const kindWeight: Record<Kind, number> = {
  reversal: 1,
  aftermath: 1,
  new_cut: 0.9,
  planned_cut: 0.6,
  trend: 0.1,
  opinion: 0.05,
  unrelated: 0,
};

export function doormanPriority(triage: Triage): number {
  return triage.isCase * mechanismWeight[triage.mechanism] * roleWeight[triage.roleType] * kindWeight[triage.kind];
}

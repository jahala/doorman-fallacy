/**
 * How to see the whole job: five steps for thinking before replacing a role. Each rests on the
 * sources in docs/research/2026-10-19-mental-model.md. Read by the home page and /idea.
 */
export interface ModelSource {
  readonly cite: string;
  readonly href?: string;
}

export interface ModelStep {
  readonly title: string;
  readonly detail: string;
  readonly sources: readonly ModelSource[];
}

export const modelSteps: readonly ModelStep[] = [
  {
    title: 'Look at the work as it is done.',
    detail:
      'A job description, and an automation plan built from it, describe work as it is imagined. The people in the role know the work as it is done. The hidden work lives in the gap between the two, so start by asking them.',
    sources: [
      {
        cite: 'Erik Hollnagel and colleagues, From Safety-I to Safety-II, EUROCONTROL, 2013',
        href: 'https://www.skybrary.aero/sites/default/files/bookshelf/3934.pdf',
      },
    ],
  },
  {
    title: 'Separate the task from the role.',
    detail:
      'A job is a bundle of tasks. A machine takes over the tasks that can be written down as rules, which are usually the most visible ones. Replacing one task is a different decision from replacing the role.',
    sources: [
      { cite: 'David Autor, Frank Levy and Richard Murnane, Quarterly Journal of Economics, 2003' },
      { cite: 'David Autor, “Why Are There Still So Many Jobs?”, 2015' },
    ],
  },
  {
    title: 'Name the invisible work, and find out why it is there.',
    detail:
      'Coordinating, smoothing over, remembering and calming people are real work that is rarely written down. Use the six kinds of hidden work as a list. Before removing a step or a person that seems to do little, find out what they are for.',
    sources: [
      {
        cite: 'Susan Leigh Star and Anselm Strauss, “Layers of Silence, Arenas of Voice”, 1999',
        href: 'https://doi.org/10.1023/A:1008651105359',
      },
      { cite: 'Arlie Russell Hochschild, The Managed Heart, 1983' },
      { cite: 'G. K. Chesterton, The Thing, 1929' },
    ],
  },
  {
    title: 'Count what is lost as well as what is saved.',
    detail:
      'The saving on the visible task is easy to measure, so it gets counted. What the person also did is hard to measure, so it drops out of the decision. A target built on the visible task soon stops describing the job.',
    sources: [
      { cite: 'Daniel Yankelovich, 1972, on the McNamara fallacy' },
      { cite: 'Charles Goodhart, 1975, in Marilyn Strathern’s wording, 1997' },
    ],
  },
  {
    title: 'Where the hidden work is large, help the person rather than replace them.',
    detail:
      'Automation that takes the task and adds little else removes people without much gain. Tools that make a person better at the whole job keep the hidden work and add to it. When people stay, they keep the hardest cases, so they need practice and support.',
    sources: [
      {
        cite: 'Daron Acemoglu and Pascual Restrepo, “Automation and New Tasks”, 2019',
        href: 'https://www.aeaweb.org/doi/10.1257/jep.33.2.3',
      },
      {
        cite: 'Erik Brynjolfsson, “The Turing Trap”, 2022',
        href: 'https://www.amacad.org/publication/daedalus/turing-trap-promise-peril-human-artificial-intelligence',
      },
      { cite: 'Lisanne Bainbridge, “Ironies of Automation”, 1983' },
    ],
  },
];

# A mental model for seeing the whole job (2026-10-19)

The site's three questions say what to ask. This memo is the research behind how to think: five steps, each resting on an established source. Every source below was checked against a primary listing on 2026-10-19; the claim the site makes from it is stated next to it, and nothing beyond that claim is attributed to the author.

## The five steps

| Step | Source, checked | What the site claims from it |
|---|---|---|
| 1. Look at the work as it is done | Erik Hollnagel, Jörg Leonhardt, Tony Licu and Steven Shorrock, *From Safety-I to Safety-II: A White Paper*, EUROCONTROL, 2013 ([SKYbrary copy](https://www.skybrary.aero/sites/default/files/bookshelf/3934.pdf)) | Work-as-imagined is what people assume about how work should be done; work-as-done is how it is actually done. Plans and job descriptions describe the first. |
| 2. Separate the task from the role | David Autor, Frank Levy and Richard Murnane, "The Skill Content of Recent Technological Change: An Empirical Exploration", *Quarterly Journal of Economics* 118(4), 2003; David Autor, "Why Are There Still So Many Jobs?", *Journal of Economic Perspectives* 29(3), 2015 | Jobs are bundles of tasks, and machines take over tasks that can be fully described as rules. |
| 3. Name the invisible work, and know why it is there | Susan Leigh Star and Anselm Strauss, "Layers of Silence, Arenas of Voice: The Ecology of Visible and Invisible Work", *Computer Supported Cooperative Work* 8, 1999 ([doi:10.1023/A:1008651105359](https://doi.org/10.1023/A:1008651105359)); Arlie Russell Hochschild, *The Managed Heart: Commercialization of Human Feeling*, 1983; G. K. Chesterton, *The Thing*, 1929 | Much necessary work, including the coordinating work Star and Strauss call articulation work, is not seen or named. Hochschild named the work of managing customers' and one's own feelings "emotional labour". Chesterton's fence: do not remove something until you know why it was put there. |
| 4. Count what is lost as well as what is saved | Daniel Yankelovich, 1972, on what is now called the McNamara fallacy; Charles Goodhart, 1975; Marilyn Strathern, 1997 | Measuring what is easy and treating the rest as unimportant leaves the hard-to-measure out of the decision. "When a measure becomes a target, it ceases to be a good measure" is Strathern's wording of Goodhart's point. |
| 5. Where the hidden work is large, help the person rather than replace them | Daron Acemoglu and Pascual Restrepo, "Automation and New Tasks: How Technology Displaces and Reinstates Labor", *Journal of Economic Perspectives* 33(2), 2019 ([AEA](https://www.aeaweb.org/doi/10.1257/jep.33.2.3)); Erik Brynjolfsson, "The Turing Trap: The Promise & Peril of Human-Like Artificial Intelligence", *Daedalus*, Spring 2022 ([American Academy](https://www.amacad.org/publication/daedalus/turing-trap-promise-peril-human-artificial-intelligence)); Lisanne Bainbridge, "Ironies of Automation", *Automatica* 19(6), 1983 | Acemoglu and Restrepo: "so-so technologies" displace workers while adding little productivity. Brynjolfsson: AI that augments people creates more value than AI that imitates them, and there are excess incentives to automate. Bainbridge: automating the routine leaves people with the hardest cases and less practice at them. |

## Why five steps

The site already has six signs (what a decision making the mistake looks like) and six kinds of hidden work (what goes missing). The steps are how to think before deciding; five keeps them distinct from both lists. Chesterton's fence joins step 3, because knowing why a piece of work is there is part of naming it.

## Illustrations

Built in HTML and CSS with real text, so they reflow on phones and read aloud; SVG only for icons and decorative lines, coloured with `currentColor` so they follow the tokens in both schemes.

1. **The whole job** (home page): the visible task as a small box inside a larger frame, with the six kinds of hidden work around it. The job description draws the inner box; the work fills the frame.
2. **Where the work goes** (/idea, step 5): before the change, one person holds the task and the hidden work; after it, the system takes the task and the hidden work goes to another team, the customer, or nobody. The three destinations are the home page's own question.
3. **Saved now, lost later** (/idea, after the announcement): the saving is counted at once in the business case; the costs arrive months later in other budgets.
4. **Six icons**, one per kind of hidden work, used wherever the six appear.

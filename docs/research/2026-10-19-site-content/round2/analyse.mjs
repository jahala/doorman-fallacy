// Reads results.json and prints the findings. Every threshold is here.
import { readFileSync } from 'node:fs';
const CONFIG = { use: 0.6, visit: 0.6, essentialUseful: 0.6 };
const { answers } = JSON.parse(readFileSync('results.json', 'utf8'));
const subjects = JSON.parse(readFileSync('subjects.json', 'utf8'));
const personas = Object.keys(answers);
const items = subjects.find((s) => s.id === 'content').items;
const short = (p) => p.slice(0, 5);

console.log('\n## Content: share of personas who would use it (noul >= %s), mean noul, mean P(essential+useful)\n', CONFIG.use);
const rows = items.map((item) => {
  const per = personas.map((p) => answers[p].content[item.id]);
  const use = per.map((a) => a.use.noul);
  const eu = per.map((a) => a.weight.probabilities.essential + a.weight.probabilities.useful);
  const ess = per.map((a) => a.weight.probabilities.essential);
  return { id: item.id, kind: item.source === 'candidate' ? 'NEW' : item.source === 'calibration' ? 'CAL' : 'built',
    users: use.filter((u) => u >= CONFIG.use).length, meanUse: use.reduce((a, b) => a + b) / use.length,
    meanEU: eu.reduce((a, b) => a + b) / eu.length, meanEss: ess.reduce((a, b) => a + b) / ess.length,
    who: personas.filter((p, i) => use[i] >= CONFIG.use).map(short).join(' ') };
}).sort((a, b) => b.meanUse - a.meanUse);
for (const r of rows) console.log(`${r.kind.padEnd(5)} ${r.id.padEnd(16)} users ${String(r.users)}/9  use ${r.meanUse.toFixed(2)}  ess+use ${r.meanEU.toFixed(2)}  ess ${r.meanEss.toFixed(2)}  | ${r.who}`);

console.log('\n## Pages: visit probability per persona\n');
const pages = subjects.find((s) => s.id === 'pages').items;
console.log('page'.padEnd(10), personas.map(short).join(' '));
for (const page of pages) console.log(page.id.padEnd(10), personas.map((p) => answers[p].pages[page.id].visit.noul.toFixed(2)).join(' '));

console.log('\n## Home: what a first-time visitor should see first\n');
for (const p of personas) {
  const a = answers[p].home._subject.first;
  const top = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  console.log(`${p.padEnd(14)} ${top}  (confidence ${a.confidence.toFixed(2)})`);
}
const totals = {};
for (const p of personas) for (const [k, v] of Object.entries(answers[p].home._subject.first.probabilities)) totals[k] = (totals[k] ?? 0) + v / personas.length;
console.log('mean:', Object.entries(totals).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '));

console.log('\n## Per persona: top six content blocks by use\n');
for (const p of personas) {
  const top = items.map((i) => [i.id, answers[p].content[i.id].use.noul]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  console.log(`${p.padEnd(14)} ${top}`);
}

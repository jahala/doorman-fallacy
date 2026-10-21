/**
 * Search or fetch by hand with DeepSeek, for checking a lead the sweep missed.
 *
 *   node desk/search.ts 'Telenor kunstig intelligens lang:no after:2024-01-01'
 *   node desk/search.ts --count 5 --content 'Klarna rehiring customer service'
 *   node desk/search.ts --fetch https://www.t-a.no/ai-robot-fikk-terningkast-6-sa-mistet-35-ansatte-i-telenor-jobben/
 *
 * Each request costs $0.00075 and goes through the same budget door as the desk's other calls.
 */
import { parseArgs } from 'node:util';
import { createBudget } from './budget.ts';
import { createDeepseekDoor, deepseekKey } from './deepseek.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    count: { type: 'string', default: '10' },
    content: { type: 'boolean', default: false },
    fetch: { type: 'string' },
    budget: { type: 'string', default: '0.05' },
  },
});

const key = await deepseekKey();
if (key === null) {
  console.error('search: no DEEPSEEK_API_KEY in the environment or the Keychain');
  process.exit(2);
}
const budget = createBudget(Number(values.budget));
const door = createDeepseekDoor({ budget, key });

if (values.fetch !== undefined) {
  const page = await door.fetchPage(values.fetch);
  if (!page.ok) {
    console.error(`search: ${page.reason}: ${page.message}`);
    process.exit(1);
  }
  console.log(`# ${page.title}\n\n${page.content}`);
} else {
  const query = positionals.join(' ');
  if (query === '') {
    console.error('search: give a query, or --fetch <url>');
    process.exit(2);
  }
  const found = await door.search(query, { count: Number(values.count), content: values.content });
  if (!found.ok) {
    console.error(`search: ${found.reason}: ${found.message}`);
    process.exit(1);
  }
  const results = (found.raw as { results?: { rerank_score?: number; content?: string }[] }).results ?? [];
  found.leads.forEach((lead, index) => {
    const score = results[index]?.rerank_score?.toFixed(2) ?? '';
    console.log(`${score}  ${lead.published || '----------'}  ${lead.outlet}\n      ${lead.title}\n      ${lead.url}`);
    const text = results[index]?.content ?? '';
    if (values.content && text !== '') console.log(`\n${text.slice(0, 2000)}\n`);
  });
}
console.error(`search: spent $${budget.spent().toFixed(5)}`);

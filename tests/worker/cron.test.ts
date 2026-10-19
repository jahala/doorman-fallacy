import { createScheduledController } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../../src/worker/index.ts';
import { clearTables, rows, run } from './helpers.ts';

const now = new Date('2026-10-19T03:17:00.000Z');
const ago = (days: number, extraMs = 0): string => new Date(now.getTime() - days * 86_400_000 - extraMs).toISOString();

async function runJob(): Promise<void> {
  await worker.scheduled(createScheduledController({ scheduledTime: now, cron: '17 3 * * *' }), env);
}

beforeEach(clearTables);

describe('the daily retention job', () => {
  it('deletes unconfirmed subscribers 7 days after their last email, and keeps the rest', async () => {
    const insert = (email: string, sent: string, confirmed: string | null): Promise<void> =>
      run('INSERT INTO subscribers (email, token, created_at, token_sent_at, confirmed_at) VALUES (?1, ?2, ?3, ?3, ?4)', email, email, sent, confirmed);
    await insert('expired@example.com', ago(7, 1), null);
    await insert('on-the-line@example.com', ago(7), null);
    await insert('recent@example.com', ago(1), null);
    await insert('confirmed-long-ago@example.com', ago(400), ago(399));
    await runJob();
    expect((await rows<{ email: string }>('SELECT email FROM subscribers ORDER BY email')).map((row) => row.email)).toEqual([
      'confirmed-long-ago@example.com',
      'on-the-line@example.com',
      'recent@example.com',
    ]);
  });

  it('blanks name and email on suggestions resolved more than 90 days ago, and keeps everything else on the row', async () => {
    const insert = (note: string, resolved: string | null): Promise<void> =>
      run(
        `INSERT INTO suggestions (created_at, kind, links, note, name, email, credit, resolved_at)
         VALUES (?1, 'case', '["https://a.example/"]', ?2, 'Ada', 'ada@example.com', 1, ?3)`,
        ago(200),
        note,
        resolved,
      );
    await insert('old', ago(90, 1));
    await insert('on the line', ago(90));
    await insert('recent', ago(10));
    await insert('unresolved', null);
    await runJob();
    expect(await rows('SELECT note, name, email, credit, links FROM suggestions ORDER BY id')).toEqual([
      { note: 'old', name: null, email: null, credit: 1, links: '["https://a.example/"]' },
      { note: 'on the line', name: 'Ada', email: 'ada@example.com', credit: 1, links: '["https://a.example/"]' },
      { note: 'recent', name: 'Ada', email: 'ada@example.com', credit: 1, links: '["https://a.example/"]' },
      { note: 'unresolved', name: 'Ada', email: 'ada@example.com', credit: 1, links: '["https://a.example/"]' },
    ]);
  });

  it('deletes seen rows and runs older than a year', async () => {
    await run('INSERT INTO seen (url, last_seen_at) VALUES (?1, ?2), (?3, ?4), (?5, ?6)', 'old', ago(365, 1), 'edge', ago(365), 'new', ago(3));
    await run(
      'INSERT INTO runs (started_at) VALUES (?1), (?2), (?3)',
      ago(365, 1),
      ago(365),
      ago(7),
    );
    await runJob();
    expect((await rows<{ url: string }>('SELECT url FROM seen ORDER BY url')).map((row) => row.url)).toEqual(['edge', 'new']);
    expect(await rows('SELECT started_at FROM runs ORDER BY started_at')).toEqual([{ started_at: ago(365) }, { started_at: ago(7) }]);
  });

  it('deletes rate-limit rows that no longer count, and keeps the ones that do', async () => {
    await run('INSERT INTO rate_hits (key, hit_at) VALUES (?1, ?2), (?1, ?3)', 'k', new Date(now.getTime() - 3_600_000 - 1).toISOString(), new Date(now.getTime() - 60_000).toISOString());
    await runJob();
    expect(await rows('SELECT hit_at FROM rate_hits')).toEqual([{ hit_at: new Date(now.getTime() - 60_000).toISOString() }]);
  });

  it('leaves leads alone: the desk decides when a lead goes', async () => {
    await run(`INSERT INTO leads (url, title, found_at) VALUES ('https://a.example/', 'A lead', ?1)`, ago(500));
    await runJob();
    expect(await rows('SELECT url FROM leads')).toEqual([{ url: 'https://a.example/' }]);
  });

  it('is safe to run twice in a row', async () => {
    await run('INSERT INTO seen (url, last_seen_at) VALUES (?1, ?2)', 'old', ago(400));
    await runJob();
    await runJob();
    expect(await rows('SELECT url FROM seen')).toEqual([]);
  });
});

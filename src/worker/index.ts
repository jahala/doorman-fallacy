import { cfmailSender } from './cfmail.ts';
import { runRetention } from './cron.ts';
import { handle } from './routes.ts';

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env, {
        now: new Date(),
        randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
        sendMail: cfmailSender(env.CFMAIL_KEY),
      });
    } catch (error) {
      // A failure in the database or the assets. Log what failed, never what was submitted.
      console.error('unhandled error', error instanceof Error ? error.message : 'unknown');
      return new Response('Something went wrong. Please try again in a moment.', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
  },

  async scheduled(controller, env) {
    await runRetention(env.DB, new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;

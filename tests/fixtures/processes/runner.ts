// Starts a long child through runTracked and reports its process id, then waits to be killed.
import { runTracked } from '../../../desk/processes.ts';

const pending = runTracked('sleep', ['30'], { timeoutMs: 60_000, onStart: (pid) => console.log(`child ${String(pid)}`) });
await pending;

import { latestOf, type Case, type CaseUpdate } from '../data/case-schema.ts';
import type { StatusId } from '../data/statuses.ts';

type WithUpdates = Pick<Case, 'updates'>;

/** The newest update. Updates are stored oldest first and a case has at least one. */
export function latestUpdate(subject: WithUpdates): CaseUpdate {
  return latestOf(subject.updates);
}

/** The current status is the latest update's status. It is never stored on its own. */
export function currentStatus(subject: WithUpdates): StatusId {
  return latestUpdate(subject).status;
}

/**
 * The update that brought the case to its current status: the first of the newest run of updates
 * with that status. Later news that leaves the status as it is does not replace it.
 */
export function statusUpdate(subject: WithUpdates): CaseUpdate {
  const status = currentStatus(subject);
  let at = subject.updates.length - 1;
  while (at > 0 && subject.updates[at - 1]?.status === status) at -= 1;
  return subject.updates[at] ?? latestUpdate(subject);
}


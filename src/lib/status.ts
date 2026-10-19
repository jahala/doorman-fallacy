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

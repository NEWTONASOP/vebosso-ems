import { Profile, WorkLogStatus } from '../types/database';

export type LiveMemberStatus = WorkLogStatus | 'offline' | 'on_leave';

/** Lower = higher on the list (actionable / active first). */
export const LIVE_STATUS_SORT_ORDER: Record<LiveMemberStatus, number> = {
  pending_approval: 0,
  pending_checkout: 1,
  working: 2,
  on_leave: 3,
  rejected: 4,
  done: 5,
  offline: 6,
};

export function compareMembersByLiveStatus(
  a: Profile,
  b: Profile,
  liveStatus: Record<string, { status?: LiveMemberStatus }>,
): number {
  const statusA = liveStatus[a.id]?.status ?? 'offline';
  const statusB = liveStatus[b.id]?.status ?? 'offline';
  const orderDiff =
    (LIVE_STATUS_SORT_ORDER[statusA] ?? 99) - (LIVE_STATUS_SORT_ORDER[statusB] ?? 99);
  if (orderDiff !== 0) return orderDiff;
  return a.full_name.localeCompare(b.full_name);
}

export function sortMembersByLiveStatus(
  members: Profile[],
  liveStatus: Record<string, { status?: LiveMemberStatus }>,
): Profile[] {
  return [...members].sort((a, b) => compareMembersByLiveStatus(a, b, liveStatus));
}

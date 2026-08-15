export type GroupStatus = 'completed' | 'active' | 'not_started';

/** A group is completed if every one of its items is 100% for this tower, active if
 * anything has started, not_started otherwise — mirrors the validated prototype's logic. */
export function computeGroupStatus(itemKeys: string[], percentByKey: Record<string, number> | undefined): GroupStatus {
  if (itemKeys.length === 0) return 'not_started';
  const percents = itemKeys.map((k) => percentByKey?.[k] ?? 0);
  const doneCount = percents.filter((p) => p >= 100).length;
  const activeCount = percents.filter((p) => p > 0 && p < 100).length;
  if (doneCount === itemKeys.length) return 'completed';
  if (doneCount > 0 || activeCount > 0) return 'active';
  return 'not_started';
}

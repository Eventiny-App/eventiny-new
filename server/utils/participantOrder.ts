/**
 * Shared utility for building the preselection participant order.
 *
 * Accepts a list of participant entries that each carry `pinnedPosition` (Int?)
 * and an `unpinnedSort` comparator that controls how non-pinned participants
 * are ordered (random for live start, by registeredAt for deterministic PDF preview).
 *
 * Algorithm:
 *   1. Pinned participants (pinnedPosition != null) are sorted by desired position.
 *   2. Each pinned participant is placed at its desired slot, clamped to [1, total].
 *      If that slot is already taken, the nearest free slot is used (±1, ±2, …).
 *   3. Unpinned participants fill the remaining slots in the order given by unpinnedSort.
 */
export function buildPreselectionOrder<T extends { pinnedPosition: number | null }>(
  participants: T[],
  unpinnedSort: (a: T, b: T) => number,
): T[] {
  const total = participants.length
  if (total === 0) return []

  const pinned = [...participants]
    .filter(pc => pc.pinnedPosition !== null)
    .sort((a, b) => (a.pinnedPosition as number) - (b.pinnedPosition as number))

  const unpinned = [...participants]
    .filter(pc => pc.pinnedPosition === null)
    .sort(unpinnedSort)

  const slotMap = new Map<number, T>()
  for (const pc of pinned) {
    const desired = Math.min(Math.max(pc.pinnedPosition as number, 1), total)
    let slot = desired
    let offset = 1
    while (slotMap.has(slot)) {
      slot = desired + (offset % 2 === 1 ? offset : -offset)
      slot = Math.min(Math.max(slot, 1), total)
      offset++
    }
    slotMap.set(slot, pc)
  }

  const ordered: T[] = []
  let unpinnedIdx = 0
  for (let pos = 1; pos <= total; pos++) {
    if (slotMap.has(pos)) {
      ordered.push(slotMap.get(pos)!)
    } else {
      ordered.push(unpinned[unpinnedIdx++]!)
    }
  }

  return ordered
}

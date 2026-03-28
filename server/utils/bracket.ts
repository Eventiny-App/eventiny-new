/**
 * Bracket generation utilities for single-elimination battle tournaments.
 */

export interface SeedEntry {
  participantId: string
  seed: number // 1 = best, 2 = second best, etc.
}

/**
 * Generate first-round matchups for a single-elimination bracket.
 * Uses standard seeding: 1v(N), 2v(N-1), etc. with byes for non-power-of-2 sizes.
 */
export function generateSingleEliminationBracket(seeds: SeedEntry[]): {
  round: number
  position: number
  bracket: string
  participant1Id: string | null
  participant2Id: string | null
}[] {
  const n = seeds.length
  if (n < 2) return []

  // Find next power of 2
  const bracketSize = nextPowerOf2(n)
  const rounds = Math.log2(bracketSize)

  // Standard seeding matchups for first round
  const firstRound = generateFirstRoundMatchups(seeds, bracketSize)

  const matchups: {
    round: number
    position: number
    bracket: string
    participant1Id: string | null
    participant2Id: string | null
  }[] = []

  // First round
  firstRound.forEach((matchup, i) => {
    matchups.push({
      round: 1,
      position: i + 1,
      bracket: 'winners',
      participant1Id: matchup[0]?.participantId || null,
      participant2Id: matchup[1]?.participantId || null,
    })
  })

  // Placeholder matchups for subsequent rounds
  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round)
    for (let pos = 1; pos <= matchesInRound; pos++) {
      matchups.push({
        round,
        position: pos,
        bracket: 'winners',
        participant1Id: null,
        participant2Id: null,
      })
    }
  }

  return matchups
}

/**
 * Standard seeding for first round.
 * 1v(N), 2v(N-1), etc. Byes assigned to highest seeds.
 */
function generateFirstRoundMatchups(
  seeds: SeedEntry[],
  bracketSize: number
): [SeedEntry | null, SeedEntry | null][] {
  const n = seeds.length
  const matchCount = bracketSize / 2
  const byes = bracketSize - n

  // Create seed map
  const seedMap = new Map<number, SeedEntry>()
  for (const s of seeds) {
    seedMap.set(s.seed, s)
  }

  // Generate standard bracket order
  const order = standardBracketOrder(bracketSize)

  const matchups: [SeedEntry | null, SeedEntry | null][] = []
  for (let i = 0; i < matchCount; i++) {
    const seed1 = order[i * 2]
    const seed2 = order[i * 2 + 1]
    matchups.push([
      seedMap.get(seed1) || null,
      seedMap.get(seed2) || null,
    ])
  }

  return matchups
}

/**
 * Generate standard bracket seeding order.
 * E.g., for 8: [1,8,4,5,2,7,3,6]
 */
function standardBracketOrder(size: number): number[] {
  if (size === 2) return [1, 2]
  const half = standardBracketOrder(size / 2)
  const result: number[] = []
  for (const seed of half) {
    result.push(seed, size + 1 - seed)
  }
  return result
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

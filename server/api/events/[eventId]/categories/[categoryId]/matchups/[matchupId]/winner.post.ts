import { z } from 'zod'

const schema = z.object({
  winnerId: z.string().min(1),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/matchups/:matchupId/winner
 * Set the winner of a battle matchup. The winner advances to the next round.
 * For 'hands' mode: host directly sets winner.
 * For 'app' mode: called after reviewing judge votes.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId, matchupId } = event.context.params as {
    eventId: string; categoryId: string; matchupId: string
  }
  await requireAuth(event, 'superadmin', 'organizer', 'host')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { winnerId } = parsed.data

  const matchup = await prisma.battleMatchup.findFirst({
    where: { id: matchupId, categoryId, category: { eventId } },
    include: { category: { select: { battleVotingMode: true } } },
  })

  if (!matchup) {
    throw createError({ statusCode: 404, statusMessage: 'Matchup not found' })
  }

  // In app voting mode, winners are determined automatically by judge votes
  if (matchup.category.battleVotingMode === 'app') {
    throw createError({ statusCode: 400, statusMessage: 'In app voting mode, winners are determined by judge votes. The host cannot manually override the result.' })
  }

  if (winnerId !== matchup.participant1Id && winnerId !== matchup.participant2Id) {
    throw createError({ statusCode: 400, statusMessage: 'Winner must be one of the two participants in this matchup' })
  }

  // Set winner
  await prisma.battleMatchup.update({
    where: { id: matchupId },
    data: { winnerId },
  })

  // Advance winner to next round in the bracket
  if (matchup.bracket === 'winners') {
    // Find next winners bracket matchup
    const nextRound = matchup.round + 1
    const nextPosition = Math.ceil(matchup.position / 2)
    const isTop = matchup.position % 2 === 1 // odd positions go to participant1 slot

    const nextMatchup = await prisma.battleMatchup.findFirst({
      where: { categoryId, bracket: 'winners', round: nextRound, position: nextPosition },
    })

    if (nextMatchup) {
      await prisma.battleMatchup.update({
        where: { id: nextMatchup.id },
        data: isTop ? { participant1Id: winnerId } : { participant2Id: winnerId },
      })
    }
  }

  return { success: true, winnerId }
})

/**
 * POST /api/events/:eventId/categories/:categoryId/matchups/:matchupId/undo-winner
 * Undo the winner of a battle matchup. Clears the winner and un-propagates from the next round.
 * Only allowed if the next round matchup hasn't been played yet.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId, matchupId } = event.context.params as {
    eventId: string; categoryId: string; matchupId: string
  }
  await requireAuth(event, 'superadmin', 'organizer', 'host')

  const matchup = await prisma.battleMatchup.findFirst({
    where: { id: matchupId, categoryId, category: { eventId } },
  })

  if (!matchup) {
    throw createError({ statusCode: 404, statusMessage: 'Matchup not found' })
  }

  if (!matchup.winnerId) {
    throw createError({ statusCode: 400, statusMessage: 'This matchup has no winner to undo' })
  }

  const winnerId = matchup.winnerId

  // Check if winner was propagated to next round
  if (matchup.bracket === 'winners') {
    const nextRound = matchup.round + 1
    const nextPosition = Math.ceil(matchup.position / 2)
    const isTop = matchup.position % 2 === 1

    const nextMatchup = await prisma.battleMatchup.findFirst({
      where: { categoryId, bracket: 'winners', round: nextRound, position: nextPosition },
    })

    if (nextMatchup) {
      // Block undo if next round matchup already has a winner
      if (nextMatchup.winnerId) {
        throw createError({ statusCode: 400, statusMessage: 'Cannot undo: the next round matchup has already been played. Undo that one first.' })
      }

      // Clear the propagated participant from next round
      await prisma.battleMatchup.update({
        where: { id: nextMatchup.id },
        data: isTop ? { participant1Id: null } : { participant2Id: null },
      })
    }
  }

  // Clear winner
  await prisma.battleMatchup.update({
    where: { id: matchupId },
    data: { winnerId: null },
  })

  return { success: true }
})

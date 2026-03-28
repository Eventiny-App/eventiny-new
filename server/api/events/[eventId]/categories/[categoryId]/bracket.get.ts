/**
 * GET /api/events/:eventId/categories/:categoryId/bracket
 * Returns all matchups in the bracket with participant names and vote info.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  await requireAuth(event, 'superadmin', 'organizer', 'judge', 'host')

  const matchups = await prisma.battleMatchup.findMany({
    where: { categoryId, category: { eventId } },
    include: {
      participant1: { select: { id: true, name: true } },
      participant2: { select: { id: true, name: true } },
      winner: { select: { id: true, name: true } },
      battleVotes: {
        include: {
          judge: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { position: 'asc' }],
  })

  // Group by bracket
  const winners = matchups.filter(m => m.bracket === 'winners')

  return {
    winners,
    all: matchups,
  }
})

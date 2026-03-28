/**
 * GET /api/events/:eventId/categories/:categoryId/votes/my
 * Returns the current judge's votes for this category.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  const user = await requireAuth(event, 'judge')

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  if (category.type === 'choreo') {
    const votes = await prisma.choreoVote.findMany({
      where: { judgeId: user.judgeId!, categoryId },
      include: { theme: { select: { id: true, name: true } } },
    })

    // Group by participant
    const byParticipant: Record<string, { themeId: string; themeName: string; score: number }[]> = {}
    for (const v of votes) {
      if (!byParticipant[v.participantId]) byParticipant[v.participantId] = []
      byParticipant[v.participantId].push({
        themeId: v.theme.id,
        themeName: v.theme.name,
        score: v.score,
      })
    }

    return { type: 'choreo', votes: byParticipant }
  } else {
    const votes = await prisma.preselectionVote.findMany({
      where: { judgeId: user.judgeId!, categoryId },
    })

    const byParticipant: Record<string, number> = {}
    for (const v of votes) {
      byParticipant[v.participantId] = v.score
    }

    return { type: 'preselection', votes: byParticipant }
  }
})

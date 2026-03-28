/**
 * GET /api/events/:eventId/categories/:categoryId/state
 * Returns live category state — used by host and judges for polling.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }

  // Any authenticated user for this event can poll state
  await requireAuth(event, 'superadmin', 'organizer', 'judge', 'host')

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
    include: {
      categoryState: true,
      choreoThemes: { orderBy: { sortOrder: 'asc' } },
      participantCategories: {
        where: { withdrawn: false },
        orderBy: { orderPosition: 'asc' },
        include: { participant: { select: { id: true, name: true } } },
      },
      judgeCategories: {
        include: { judge: { select: { id: true, name: true } } },
      },
    },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  // Compute progress: who has been fully voted on?
  const participants = category.participantCategories.map(pc => ({
    id: pc.participant.id,
    name: pc.participant.name,
    orderPosition: pc.orderPosition,
  }))

  const judges = category.judgeCategories.map(jc => ({
    id: jc.judge.id,
    name: jc.judge.name,
    weight: jc.weight,
  }))

  // Get all existing votes for this category
  let votes: { judgeId: string; participantId: string }[] = []
  if (category.type === 'battle') {
    votes = await prisma.preselectionVote.findMany({
      where: { categoryId },
      select: { judgeId: true, participantId: true },
    })
  } else {
    // For choreo, a participant is "voted" when ALL themes have been scored by a judge
    const themeCount = category.choreoThemes.length
    if (themeCount > 0) {
      const choreoVotes = await prisma.choreoVote.groupBy({
        by: ['judgeId', 'participantId'],
        where: { categoryId },
        _count: { id: true },
      })
      votes = choreoVotes
        .filter(v => v._count.id >= themeCount)
        .map(v => ({ judgeId: v.judgeId, participantId: v.participantId }))
    }
  }

  // Per-participant vote status
  const participantVoteStatus = participants.map(p => {
    const judgeVotes = judges.map(j => ({
      judgeId: j.id,
      judgeName: j.name,
      hasVoted: votes.some(v => v.judgeId === j.id && v.participantId === p.id),
    }))
    return {
      participantId: p.id,
      participantName: p.name,
      orderPosition: p.orderPosition,
      allJudgesVoted: judgeVotes.every(jv => jv.hasVoted),
      judgeVotes,
    }
  })

  return {
    categoryId: category.id,
    categoryName: category.name,
    type: category.type,
    bracketSize: category.bracketSize,
    battleVotingMode: category.battleVotingMode,
    phase: category.categoryState?.phase || 'idle',
    currentParticipantId: category.categoryState?.currentParticipantId,
    currentMatchupId: category.categoryState?.currentMatchupId,
    currentRound: category.categoryState?.currentRound,
    timerDuration: category.categoryState?.timerDuration || 60,
    participants,
    judges,
    themes: category.choreoThemes.map(t => ({ id: t.id, name: t.name })),
    participantVoteStatus,
    totalParticipants: participants.length,
    totalJudges: judges.length,
    completedParticipants: participantVoteStatus.filter(p => p.allJudgesVoted).length,
  }
})

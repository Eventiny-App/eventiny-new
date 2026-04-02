import { z } from 'zod'

const schema = z.object({
  votedParticipantId: z.string().min(1),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/matchups/:matchupId/vote
 * Judge votes for whom they think won the battle.
 * Only used in 'app' voting mode.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId, matchupId } = event.context.params as {
    eventId: string; categoryId: string; matchupId: string
  }
  const user = await requireAuth(event, 'judge')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { votedParticipantId } = parsed.data

  // Verify matchup
  const matchup = await prisma.battleMatchup.findFirst({
    where: { id: matchupId, categoryId, category: { eventId } },
  })

  if (!matchup) {
    throw createError({ statusCode: 404, statusMessage: 'Matchup not found' })
  }

  if (votedParticipantId !== matchup.participant1Id && votedParticipantId !== matchup.participant2Id) {
    throw createError({ statusCode: 400, statusMessage: 'Must vote for one of the two battlers' })
  }

  // Verify judge is assigned to this category
  const jc = await prisma.judgeCategory.findFirst({
    where: { judgeId: user.judgeId, categoryId },
  })
  if (!jc) {
    throw createError({ statusCode: 403, statusMessage: 'Not assigned to this category' })
  }

  // Upsert vote (judge can change their vote)
  const vote = await prisma.battleVote.upsert({
    where: {
      matchupId_judgeId: {
        matchupId,
        judgeId: user.judgeId!,
      },
    },
    create: {
      matchupId,
      judgeId: user.judgeId!,
      votedParticipantId,
    },
    update: {
      votedParticipantId,
    },
  })

  // Auto-resolve: check if all assigned judges have voted
  const assignedJudges = await prisma.judgeCategory.findMany({
    where: { categoryId },
    select: { judgeId: true, weight: true },
  })

  const allVotes = await prisma.battleVote.findMany({
    where: { matchupId },
    select: { judgeId: true, votedParticipantId: true },
  })

  const totalAssigned = assignedJudges.length
  const totalVoted = allVotes.length
  const allJudgesVoted = totalVoted >= totalAssigned

  if (!allJudgesVoted) {
    return { success: true, voteId: vote.id, allVoted: false, autoResolved: false, tied: false, totalVoted, totalAssigned }
  }

  // All judges voted — tally weighted scores
  const weightMap = new Map(assignedJudges.map(j => [j.judgeId, j.weight]))
  let score1 = 0
  let score2 = 0
  for (const v of allVotes) {
    const w = weightMap.get(v.judgeId) ?? 1
    if (v.votedParticipantId === matchup.participant1Id) score1 += w
    else if (v.votedParticipantId === matchup.participant2Id) score2 += w
  }

  if (score1 === score2) {
    // Tie — host must restart the battle
    return { success: true, voteId: vote.id, allVoted: true, autoResolved: false, tied: true, totalVoted, totalAssigned, score1, score2 }
  }

  // Clear winner — auto-resolve
  const winnerId = score1 > score2 ? matchup.participant1Id! : matchup.participant2Id!

  await prisma.battleMatchup.update({
    where: { id: matchupId },
    data: { winnerId },
  })

  // Advance winner to next round
  if (matchup.bracket === 'winners') {
    const nextRound = matchup.round + 1
    const nextPosition = Math.ceil(matchup.position / 2)
    const isTop = matchup.position % 2 === 1

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

  return { success: true, voteId: vote.id, allVoted: true, autoResolved: true, tied: false, winnerId, totalVoted, totalAssigned, score1, score2 }
})

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

  return { success: true, voteId: vote.id }
})

import { z } from 'zod'

const schema = z.object({
  participantIds: z.array(z.string()).min(2).max(64),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/bracket
 * Generate battle bracket from the provided ranked participants.
 * Called by host/organizer after reviewing ranking.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  await requireAuth(event, 'superadmin', 'organizer', 'host')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { participantIds } = parsed.data

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
    include: { categoryState: true },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  if (category.categoryState?.phase !== 'ranking' && category.categoryState?.phase !== 'battles') {
    throw createError({ statusCode: 400, statusMessage: 'Category must be in ranking or battles phase to generate bracket' })
  }

  // Clear existing matchups
  await prisma.battleVote.deleteMany({ where: { matchup: { categoryId } } })
  await prisma.battleMatchup.deleteMany({ where: { categoryId } })

  // Create seed entries
  const seeds = participantIds.map((id, i) => ({
    participantId: id,
    seed: i + 1,
  }))

  // Generate single-elimination bracket
  const matchups = generateSingleEliminationBracket(seeds)

  // Create matchup records
  const created = await Promise.all(
    matchups.map(m =>
      prisma.battleMatchup.create({
        data: {
          round: m.round,
          position: m.position,
          bracket: m.bracket,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          categoryId,
        },
      })
    )
  )

  // Auto-advance byes (where one participant is null)
  for (const matchup of created) {
    if (matchup.participant1Id && !matchup.participant2Id) {
      await prisma.battleMatchup.update({
        where: { id: matchup.id },
        data: { winnerId: matchup.participant1Id },
      })
    } else if (!matchup.participant1Id && matchup.participant2Id) {
      await prisma.battleMatchup.update({
        where: { id: matchup.id },
        data: { winnerId: matchup.participant2Id },
      })
    }
  }

  return { success: true, matchupsCreated: created.length }
})

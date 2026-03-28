import { z } from 'zod'

const schema = z.object({
  participantId: z.string().min(1),
  score: z.number().min(0).max(10),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/votes/preselection
 * Judge submits a preselection score (0-10, decimals allowed) for a participant.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  const user = await requireAuth(event, 'judge')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { participantId, score } = parsed.data

  // Round to 1 decimal place
  const roundedScore = Math.round(score * 10) / 10

  // Verify category exists, is in preselection, and judge is assigned
  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
    include: { categoryState: true },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  if (category.categoryState?.phase !== 'preselection') {
    throw createError({ statusCode: 400, statusMessage: 'Category is not in preselection phase' })
  }

  // Verify judge is assigned to this category
  const judgeCategory = await prisma.judgeCategory.findFirst({
    where: { judgeId: user.judgeId, categoryId },
  })

  if (!judgeCategory) {
    throw createError({ statusCode: 403, statusMessage: 'You are not assigned to this category' })
  }

  // Verify participant is in this category and not withdrawn
  const pc = await prisma.participantCategory.findFirst({
    where: { participantId, categoryId, withdrawn: false },
  })

  if (!pc) {
    throw createError({ statusCode: 400, statusMessage: 'Participant is not in this category' })
  }

  // Upsert vote (allows judge to change their score)
  const vote = await prisma.preselectionVote.upsert({
    where: {
      judgeId_categoryId_participantId: {
        judgeId: user.judgeId!,
        categoryId,
        participantId,
      },
    },
    create: {
      judgeId: user.judgeId!,
      categoryId,
      participantId,
      score: roundedScore,
    },
    update: {
      score: roundedScore,
    },
  })

  return { success: true, voteId: vote.id, score: roundedScore }
})

import { z } from 'zod'

const schema = z.object({
  participantId: z.string().min(1),
  scores: z.array(z.object({
    themeId: z.string().min(1),
    score: z.number().min(0).max(10),
  })).min(1),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/votes/choreo
 * Judge submits choreo scores (one score per theme) for a participant.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  const user = await requireAuth(event, 'judge')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { participantId, scores } = parsed.data

  // Verify category exists, is in preselection, and is choreo type
  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId, type: 'choreo' },
    include: {
      categoryState: true,
      choreoThemes: true,
    },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Choreo category not found' })
  }

  if (category.categoryState?.phase !== 'preselection') {
    throw createError({ statusCode: 400, statusMessage: 'Category is not in preselection phase' })
  }

  // Verify judge is assigned
  const judgeCategory = await prisma.judgeCategory.findFirst({
    where: { judgeId: user.judgeId, categoryId },
  })

  if (!judgeCategory) {
    throw createError({ statusCode: 403, statusMessage: 'You are not assigned to this category' })
  }

  // Verify participant is in category
  const pc = await prisma.participantCategory.findFirst({
    where: { participantId, categoryId, withdrawn: false },
  })

  if (!pc) {
    throw createError({ statusCode: 400, statusMessage: 'Participant is not in this category' })
  }

  // Verify all theme IDs are valid
  const themeIds = new Set(category.choreoThemes.map(t => t.id))
  for (const s of scores) {
    if (!themeIds.has(s.themeId)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid theme ID: ${s.themeId}` })
    }
  }

  // Upsert each theme score
  const results = await Promise.all(
    scores.map(s => {
      const roundedScore = Math.round(s.score * 10) / 10
      return prisma.choreoVote.upsert({
        where: {
          judgeId_categoryId_participantId_themeId: {
            judgeId: user.judgeId!,
            categoryId,
            participantId,
            themeId: s.themeId,
          },
        },
        create: {
          judgeId: user.judgeId!,
          categoryId,
          participantId,
          themeId: s.themeId,
          score: roundedScore,
        },
        update: {
          score: roundedScore,
        },
      })
    })
  )

  return { success: true, votesSubmitted: results.length }
})

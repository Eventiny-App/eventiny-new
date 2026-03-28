import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  bracketSize: z.number().int().min(2).max(128).nullable().optional(),
  battleVotingMode: z.enum(['hands', 'app']).optional(),
  choreoBattleTop: z.number().int().min(2).max(128).nullable().optional(),
  choreoThemes: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const categoryId = getRouterParam(event, 'categoryId')
  if (!eventId || !categoryId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { event: true },
  })
  if (!category || category.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }
  if (auth.role === 'organizer' && category.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, updateCategorySchema.parse)

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })
    data.name = nameResult.sanitized
  }
  if (body.bracketSize !== undefined) data.bracketSize = body.bracketSize
  if (body.battleVotingMode !== undefined) data.battleVotingMode = body.battleVotingMode
  if (body.choreoBattleTop !== undefined) data.choreoBattleTop = body.choreoBattleTop

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
  })

  // Update choreo themes if provided
  if (body.choreoThemes !== undefined && category.type === 'choreo') {
    // Delete old themes and recreate (simpler than diffing)
    await prisma.choreoTheme.deleteMany({ where: { categoryId } })
    await prisma.choreoTheme.createMany({
      data: body.choreoThemes.map((t, i) => ({
        name: sanitizeName(t.name),
        sortOrder: i,
        categoryId,
      })),
    })
  }

  const result = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      choreoThemes: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { participantCategories: true, judgeCategories: true } },
    },
  })

  return result
})

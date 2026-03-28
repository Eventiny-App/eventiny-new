import { z } from 'zod'

const updateJudgeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  accessPin: z.string().min(3).max(10).optional(),
  categoryIds: z.array(z.string()).optional(),
  weights: z.record(z.string(), z.number().min(0.1).max(10)).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const judgeId = getRouterParam(event, 'judgeId')
  if (!eventId || !judgeId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const judge = await prisma.judge.findUnique({
    where: { id: judgeId },
    include: { event: true },
  })
  if (!judge || judge.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Judge not found' })
  }
  if (auth.role === 'organizer' && judge.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, updateJudgeSchema.parse)

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })
    data.name = nameResult.sanitized
  }
  if (body.accessPin !== undefined) {
    // Check PIN uniqueness
    const existingPin = await prisma.judge.findFirst({
      where: { eventId, accessPin: body.accessPin, id: { not: judgeId } },
    })
    if (existingPin) throw createError({ statusCode: 409, statusMessage: 'PIN already in use by another judge.' })
    const hostPin = await prisma.host.findUnique({
      where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
    })
    if (hostPin) throw createError({ statusCode: 409, statusMessage: 'PIN already in use by a host.' })
    data.accessPin = body.accessPin
  }

  await prisma.judge.update({ where: { id: judgeId }, data })

  // Update category assignments if provided
  if (body.categoryIds !== undefined) {
    await prisma.judgeCategory.deleteMany({ where: { judgeId } })
    if (body.categoryIds.length > 0) {
      await prisma.judgeCategory.createMany({
        data: body.categoryIds.map((catId) => ({
          judgeId,
          categoryId: catId,
          weight: body.weights?.[catId] ?? 1.0,
        })),
      })
    }
  }

  const updated = await prisma.judge.findUnique({
    where: { id: judgeId },
    include: {
      judgeCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  return updated
})

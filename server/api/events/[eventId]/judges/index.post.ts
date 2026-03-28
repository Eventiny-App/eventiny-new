import { z } from 'zod'

const createJudgeSchema = z.object({
  name: z.string().min(2).max(100),
  accessPin: z.string().min(3).max(10),
  categoryIds: z.array(z.string()).optional().default([]),
  weights: z.record(z.string(), z.number().min(0.1).max(10)).optional().default({}),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const ev = await prisma.event.findUnique({ where: { id: eventId } })
  if (!ev) throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  if (auth.role === 'organizer' && ev.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, createJudgeSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })

  // Check name uniqueness within event (case-insensitive)
  const existingJudges = await prisma.judge.findMany({
    where: { eventId },
    select: { name: true },
  })
  const lowerName = nameResult.sanitized.toLowerCase()
  if (existingJudges.some(j => j.name.toLowerCase() === lowerName)) {
    throw createError({ statusCode: 409, statusMessage: 'A judge with this name already exists in this event.' })
  }

  // Check PIN uniqueness within event
  const existingPin = await prisma.judge.findUnique({
    where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
  })
  if (existingPin) {
    // Also check hosts for PIN collision
    throw createError({ statusCode: 409, statusMessage: 'This PIN is already used by another judge in this event.' })
  }
  const hostPin = await prisma.host.findUnique({
    where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
  })
  if (hostPin) {
    throw createError({ statusCode: 409, statusMessage: 'This PIN is already used by a host in this event.' })
  }

  const judge = await prisma.judge.create({
    data: {
      name: nameResult.sanitized,
      accessPin: body.accessPin,
      eventId,
      judgeCategories: body.categoryIds.length > 0
        ? {
            create: body.categoryIds.map((catId) => ({
              categoryId: catId,
              weight: body.weights?.[catId] ?? 1.0,
            })),
          }
        : undefined,
    },
    include: {
      judgeCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  return judge
})

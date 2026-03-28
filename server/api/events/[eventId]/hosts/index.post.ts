import { z } from 'zod'

const createHostSchema = z.object({
  name: z.string().min(2).max(100),
  accessPin: z.string().min(3).max(10),
  categoryIds: z.array(z.string()).optional().default([]),
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

  const body = await readValidatedBody(event, createHostSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })

  // Check name uniqueness within event (case-insensitive)
  const existingHosts = await prisma.host.findMany({
    where: { eventId },
    select: { name: true },
  })
  const lowerName = nameResult.sanitized.toLowerCase()
  if (existingHosts.some(h => h.name.toLowerCase() === lowerName)) {
    throw createError({ statusCode: 409, statusMessage: 'A host with this name already exists in this event.' })
  }

  // Check PIN uniqueness within event (check both hosts and judges)
  const existingHostPin = await prisma.host.findUnique({
    where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
  })
  if (existingHostPin) {
    throw createError({ statusCode: 409, statusMessage: 'This PIN is already used by another host in this event.' })
  }
  const judgePin = await prisma.judge.findUnique({
    where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
  })
  if (judgePin) {
    throw createError({ statusCode: 409, statusMessage: 'This PIN is already used by a judge in this event.' })
  }

  const host = await prisma.host.create({
    data: {
      name: nameResult.sanitized,
      accessPin: body.accessPin,
      eventId,
      hostCategories: body.categoryIds.length > 0
        ? {
            create: body.categoryIds.map((catId) => ({ categoryId: catId })),
          }
        : undefined,
    },
    include: {
      hostCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  return host
})

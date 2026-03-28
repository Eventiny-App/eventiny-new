import { z } from 'zod'

const updateHostSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  accessPin: z.string().min(3).max(10).optional(),
  categoryIds: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const hostId = getRouterParam(event, 'hostId')
  if (!eventId || !hostId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { event: true },
  })
  if (!host || host.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Host not found' })
  }
  if (auth.role === 'organizer' && host.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, updateHostSchema.parse)

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })
    data.name = nameResult.sanitized
  }
  if (body.accessPin !== undefined) {
    const existingPin = await prisma.host.findFirst({
      where: { eventId, accessPin: body.accessPin, id: { not: hostId } },
    })
    if (existingPin) throw createError({ statusCode: 409, statusMessage: 'PIN already in use by another host.' })
    const judgePin = await prisma.judge.findUnique({
      where: { eventId_accessPin: { eventId, accessPin: body.accessPin } },
    })
    if (judgePin) throw createError({ statusCode: 409, statusMessage: 'PIN already in use by a judge.' })
    data.accessPin = body.accessPin
  }

  await prisma.host.update({ where: { id: hostId }, data })

  if (body.categoryIds !== undefined) {
    await prisma.hostCategory.deleteMany({ where: { hostId } })
    if (body.categoryIds.length > 0) {
      await prisma.hostCategory.createMany({
        data: body.categoryIds.map((catId) => ({ hostId, categoryId: catId })),
      })
    }
  }

  const updated = await prisma.host.findUnique({
    where: { id: hostId },
    include: {
      hostCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  return updated
})

import { z } from 'zod'

const updateEventSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  // Verify ownership
  const existing = await prisma.event.findUnique({ where: { id: eventId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  if (auth.role === 'organizer' && existing.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, updateEventSchema.parse)

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })
    data.name = nameResult.sanitized
  }
  if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) data.endDate = new Date(body.endDate)

  // Validate date range if both provided or one changes
  const start = body.startDate ? new Date(body.startDate) : existing.startDate
  const end = body.endDate ? new Date(body.endDate) : existing.endDate
  if (end <= start) {
    throw createError({ statusCode: 400, statusMessage: 'End date must be after start date' })
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  })

  return updated
})

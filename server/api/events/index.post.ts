import { z } from 'zod'

const createEventSchema = z.object({
  name: z.string().min(2).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const body = await readValidatedBody(event, createEventSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) {
    throw createError({ statusCode: 400, statusMessage: nameResult.error })
  }

  if (new Date(body.endDate) <= new Date(body.startDate)) {
    throw createError({ statusCode: 400, statusMessage: 'End date must be after start date' })
  }

  const created = await prisma.event.create({
    data: {
      name: nameResult.sanitized,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      organizerId: auth.userId!,
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
    },
  })

  return created
})

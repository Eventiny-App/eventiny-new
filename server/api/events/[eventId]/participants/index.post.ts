import { z } from 'zod'

const createParticipantSchema = z.object({
  name: z.string().min(1).max(100),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const body = await readValidatedBody(event, createParticipantSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })

  // Check name uniqueness within event (case-insensitive)
  const existingParticipants = await prisma.participant.findMany({
    where: { eventId },
    select: { name: true },
  })
  const lowerName = nameResult.sanitized.toLowerCase()
  if (existingParticipants.some(p => p.name.toLowerCase() === lowerName)) {
    throw createError({ statusCode: 409, statusMessage: 'A participant with this name already exists in this event.' })
  }

  // Verify categories belong to this event
  const categories = await prisma.category.findMany({
    where: { id: { in: body.categoryIds }, eventId },
    include: { categoryState: true },
  })
  if (categories.length !== body.categoryIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'One or more categories are invalid.' })
  }

  // For categories that have already started, participant gets appended to the end
  const participant = await prisma.participant.create({
    data: {
      name: nameResult.sanitized,
      eventId,
      participantCategories: {
        create: await Promise.all(body.categoryIds.map(async (catId) => {
          const cat = categories.find(c => c.id === catId)!
          let orderPosition: number | null = null

          // If category already started (not idle), append to end
          if (cat.categoryState && cat.categoryState.phase !== 'idle') {
            const maxPos = await prisma.participantCategory.aggregate({
              where: { categoryId: catId, withdrawn: false },
              _max: { orderPosition: true },
            })
            orderPosition = (maxPos._max.orderPosition ?? 0) + 1
          }

          return { categoryId: catId, orderPosition }
        })),
      },
    },
    include: {
      participantCategories: {
        include: { category: { select: { id: true, name: true, type: true, status: true } } },
      },
    },
  })

  return participant
})

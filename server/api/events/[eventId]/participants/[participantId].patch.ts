import { z } from 'zod'

const updateParticipantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  addCategoryIds: z.array(z.string()).optional(),
  removeCategoryIds: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host')

  const eventId = getRouterParam(event, 'eventId')
  const participantId = getRouterParam(event, 'participantId')
  if (!eventId || !participantId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      participantCategories: {
        include: { category: { select: { id: true, status: true, categoryState: true } } },
      },
    },
  })
  if (!participant || participant.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Participant not found' })
  }

  const body = await readValidatedBody(event, updateParticipantSchema.parse)

  // Update name
  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })
    await prisma.participant.update({
      where: { id: participantId },
      data: { name: nameResult.sanitized },
    })
  }

  // Add categories
  if (body.addCategoryIds?.length) {
    const categories = await prisma.category.findMany({
      where: { id: { in: body.addCategoryIds }, eventId },
      include: { categoryState: true },
    })

    for (const cat of categories) {
      const existing = await prisma.participantCategory.findUnique({
        where: { participantId_categoryId: { participantId, categoryId: cat.id } },
      })

      if (existing) {
        // If it was withdrawn, un-withdraw it
        if (existing.withdrawn) {
          await prisma.participantCategory.update({
            where: { id: existing.id },
            data: { withdrawn: false },
          })
        }
        continue
      }

      // Determine order position
      let orderPosition: number | null = null
      if (cat.categoryState && cat.categoryState.phase !== 'idle') {
        const maxPos = await prisma.participantCategory.aggregate({
          where: { categoryId: cat.id, withdrawn: false },
          _max: { orderPosition: true },
        })
        orderPosition = (maxPos._max.orderPosition ?? 0) + 1
      }

      await prisma.participantCategory.create({
        data: { participantId, categoryId: cat.id, orderPosition },
      })
    }
  }

  // Remove categories (blocked if category has started)
  if (body.removeCategoryIds?.length) {
    for (const catId of body.removeCategoryIds) {
      const pc = participant.participantCategories.find(
        (pc) => pc.category.id === catId
      )
      if (!pc) continue

      // Check if category has started — if so, block removal entirely
      const catState = await prisma.categoryState.findUnique({
        where: { categoryId: catId },
      })

      if (catState && catState.phase !== 'idle') {
        throw createError({ statusCode: 400, statusMessage: `Cannot remove participant from category "${catId}": it has already started (${catState.phase})` })
      } else {
        await prisma.participantCategory.delete({
          where: { id: pc.id },
        })
      }
    }
  }

  const updated = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      participantCategories: {
        include: { category: { select: { id: true, name: true, type: true, status: true } } },
      },
    },
  })

  return updated
})

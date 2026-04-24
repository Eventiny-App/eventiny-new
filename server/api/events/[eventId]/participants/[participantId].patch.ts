import { z } from 'zod'

const updateParticipantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  addCategoryIds: z.array(z.string()).optional(),
  removeCategoryIds: z.array(z.string()).optional(),
  pinnedPositions: z.array(z.object({
    categoryId: z.string(),
    position: z.number().int().min(1).nullable(),
  })).optional(),
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

    // Check name uniqueness within event (case-insensitive), excluding current participant
    const existingParticipants = await prisma.participant.findMany({
      where: { eventId, id: { not: participantId } },
      select: { name: true },
    })
    const lowerName = nameResult.sanitized.toLowerCase()
    if (existingParticipants.some(p => p.name.toLowerCase() === lowerName)) {
      throw createError({ statusCode: 409, statusMessage: 'A participant with this name already exists in this event.' })
    }

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
        // If it was withdrawn, un-withdraw it and append to end if category has started
        if (existing.withdrawn) {
          let orderPosition: number | null = existing.orderPosition
          if (cat.categoryState && cat.categoryState.phase !== 'idle' && orderPosition === null) {
            const maxPos = await prisma.participantCategory.aggregate({
              where: { categoryId: cat.id, withdrawn: false },
              _max: { orderPosition: true },
            })
            orderPosition = (maxPos._max.orderPosition ?? 0) + 1
          }
          await prisma.participantCategory.update({
            where: { id: existing.id },
            data: { withdrawn: false, ...(orderPosition !== existing.orderPosition ? { orderPosition } : {}) },
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

  // Update pinned positions (only allowed on idle categories)
  if (body.pinnedPositions?.length) {
    for (const { categoryId, position } of body.pinnedPositions) {
      const pc = await prisma.participantCategory.findUnique({
        where: { participantId_categoryId: { participantId, categoryId } },
      })
      if (!pc || pc.withdrawn) {
        throw createError({ statusCode: 404, statusMessage: `Participant is not in category "${categoryId}"` })
      }

      const catState = await prisma.categoryState.findUnique({ where: { categoryId } })
      if (catState && catState.phase !== 'idle') {
        throw createError({ statusCode: 400, statusMessage: `Cannot change pinned position: category has already started (${catState.phase})` })
      }

      if (position !== null) {
        const conflict = await prisma.participantCategory.findFirst({
          where: { categoryId, pinnedPosition: position, participantId: { not: participantId }, withdrawn: false },
        })
        if (conflict) {
          throw createError({ statusCode: 409, statusMessage: `Position ${position} is already pinned by another participant in this category` })
        }
      }

      await prisma.participantCategory.update({
        where: { id: pc.id },
        data: { pinnedPosition: position },
      })
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

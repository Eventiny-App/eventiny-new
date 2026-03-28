export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const categoryId = getRouterParam(event, 'categoryId')
  if (!eventId || !categoryId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { event: true, categoryState: true },
  })
  if (!category || category.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }
  if (auth.role === 'organizer' && category.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  // Block deletion if category has already started
  if (category.categoryState && category.categoryState.phase !== 'idle') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot delete a category that has already started. Change its status to idle first.',
    })
  }

  await prisma.category.delete({ where: { id: categoryId } })

  return { ok: true }
})

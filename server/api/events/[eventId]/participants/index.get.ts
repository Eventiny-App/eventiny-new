export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId.trim() : ''

  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      ...(search ? { name: { contains: search } } : {}),
      ...(categoryId ? { participantCategories: { some: { categoryId } } } : {}),
    },
    include: {
      participantCategories: {
        include: { category: { select: { id: true, name: true, type: true, status: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return participants
})

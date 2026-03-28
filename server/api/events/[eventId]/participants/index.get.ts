export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      ...(search ? { name: { contains: search } } : {}),
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

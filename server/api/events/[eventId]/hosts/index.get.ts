export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const hosts = await prisma.host.findMany({
    where: { eventId },
    include: {
      hostCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return hosts
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const judges = await prisma.judge.findMany({
    where: { eventId },
    include: {
      judgeCategories: {
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return judges
})

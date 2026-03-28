export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host', 'judge')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const categories = await prisma.category.findMany({
    where: { eventId },
    include: {
      choreoThemes: { orderBy: { sortOrder: 'asc' } },
      categoryState: true,
      _count: {
        select: {
          participantCategories: { where: { withdrawn: false } },
          judgeCategories: true,
          hostCategories: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return categories
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin', 'host', 'judge')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const where: any = { eventId }

  // Judges only see categories they are assigned to
  if (auth.role === 'judge' && auth.judgeId) {
    where.judgeCategories = { some: { judgeId: auth.judgeId } }
  }

  const categories = await prisma.category.findMany({
    where,
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

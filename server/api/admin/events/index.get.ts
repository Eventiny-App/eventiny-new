export default defineEventHandler(async (event) => {
  requireAuth(event, 'superadmin')

  const events = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      organizer: { select: { id: true, name: true, email: true } },
      _count: { select: { categories: true, participants: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return events
})

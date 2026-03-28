export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'superadmin', 'organizer')

  const where = auth.role === 'superadmin' ? {} : { organizerId: auth.userId }

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      organizer: { select: { id: true, name: true } },
      _count: { select: { categories: true, participants: true, judges: true, hosts: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return events
})

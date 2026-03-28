export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'superadmin', 'organizer', 'host', 'judge')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const ev = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      organizerId: true,
      organizer: { select: { id: true, name: true } },
      _count: { select: { categories: true, participants: true, judges: true, hosts: true } },
    },
  })

  if (!ev) throw createError({ statusCode: 404, statusMessage: 'Event not found' })

  // Organizers can only see their own events
  if (auth.role === 'organizer' && ev.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  // Judges/hosts can only see their event
  if ((auth.role === 'judge' || auth.role === 'host') && ev.id !== auth.eventId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  return ev
})

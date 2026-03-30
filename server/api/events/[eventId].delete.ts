export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  const existing = await prisma.event.findUnique({ where: { id: eventId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  if (auth.role === 'organizer' && existing.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  await prisma.event.delete({ where: { id: eventId } })

  return { deleted: true }
})

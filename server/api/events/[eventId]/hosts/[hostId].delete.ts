export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const hostId = getRouterParam(event, 'hostId')
  if (!eventId || !hostId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { event: true },
  })
  if (!host || host.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Host not found' })
  }
  if (auth.role === 'organizer' && host.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  await prisma.host.delete({ where: { id: hostId } })
  return { ok: true }
})

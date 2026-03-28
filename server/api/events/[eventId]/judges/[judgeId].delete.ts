export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const judgeId = getRouterParam(event, 'judgeId')
  if (!eventId || !judgeId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const judge = await prisma.judge.findUnique({
    where: { id: judgeId },
    include: { event: true },
  })
  if (!judge || judge.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Judge not found' })
  }
  if (auth.role === 'organizer' && judge.event.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  await prisma.judge.delete({ where: { id: judgeId } })
  return { ok: true }
})

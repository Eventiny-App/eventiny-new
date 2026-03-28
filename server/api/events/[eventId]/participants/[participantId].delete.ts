export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  const participantId = getRouterParam(event, 'participantId')
  if (!eventId || !participantId) throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      participantCategories: {
        include: { category: { include: { categoryState: true } } },
      },
    },
  })
  if (!participant || participant.eventId !== eventId) {
    throw createError({ statusCode: 404, statusMessage: 'Participant not found' })
  }

  // Check if participant is in any started categories
  const startedCategories = participant.participantCategories.filter(
    (pc) => !pc.withdrawn && pc.category.categoryState && pc.category.categoryState.phase !== 'idle'
  )

  if (startedCategories.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete: participant is in ${startedCategories.length} active category(ies). Withdraw them from those categories first.`,
    })
  }

  await prisma.participant.delete({ where: { id: participantId } })
  return { ok: true }
})

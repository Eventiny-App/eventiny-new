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
    const names = startedCategories
      .map((pc) => `"${pc.category.name}" (${pc.category.categoryState!.phase})`)
      .join(', ')
    const plural = startedCategories.length > 1
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete "${participant.name}": they are registered in ${plural ? 'categories that have' : 'a category that has'} already started: ${names}. To remove them, reset ${plural ? 'those categories' : 'the category'} to idle from the host panel ("Reset Category to Idle"). Warning: this deletes all votes in ${plural ? 'those categories' : 'that category'}.`,
    })
  }

  await prisma.participant.delete({ where: { id: participantId } })
  return { ok: true }
})

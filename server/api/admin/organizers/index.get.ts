export default defineEventHandler(async (event) => {
  requireAuth(event, 'superadmin')

  const organizers = await prisma.user.findMany({
    where: { role: 'organizer' },
    select: {
      id: true,
      email: true,
      name: true,
      enabled: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return organizers
})

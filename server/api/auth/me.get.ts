export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (auth.role === 'superadmin' || auth.role === 'organizer') {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, name: true, role: true, expiresAt: true },
    })
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'User not found' })
    }
    return { user, role: auth.role }
  }

  if (auth.role === 'judge') {
    const judge = await prisma.judge.findUnique({
      where: { id: auth.judgeId },
      select: { id: true, name: true, eventId: true },
    })
    if (!judge) {
      throw createError({ statusCode: 401, statusMessage: 'Judge not found' })
    }
    return { judge, role: auth.role, eventId: auth.eventId }
  }

  if (auth.role === 'host') {
    const host = await prisma.host.findUnique({
      where: { id: auth.hostId },
      select: { id: true, name: true, eventId: true },
    })
    if (!host) {
      throw createError({ statusCode: 401, statusMessage: 'Host not found' })
    }
    return { host, role: auth.role, eventId: auth.eventId }
  }

  throw createError({ statusCode: 401, statusMessage: 'Unknown role' })
})

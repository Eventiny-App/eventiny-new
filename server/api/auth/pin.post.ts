import { z } from 'zod'

const pinLoginSchema = z.object({
  eventId: z.string().min(1),
  pin: z.string().min(1),
  role: z.enum(['judge', 'host']),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, pinLoginSchema.parse)

  if (body.role === 'judge') {
    const judge = await prisma.judge.findUnique({
      where: {
        eventId_accessPin: {
          eventId: body.eventId,
          accessPin: body.pin,
        },
      },
      select: { id: true, name: true, eventId: true },
    })

    if (!judge) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid PIN' })
    }

    const token = signToken({
      judgeId: judge.id,
      eventId: judge.eventId,
      role: 'judge',
    })

    setCookie(event, 'eventiny_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 3, // 3 days (event duration)
      path: '/',
    })

    return { judge, token }
  }

  if (body.role === 'host') {
    const host = await prisma.host.findUnique({
      where: {
        eventId_accessPin: {
          eventId: body.eventId,
          accessPin: body.pin,
        },
      },
      select: { id: true, name: true, eventId: true },
    })

    if (!host) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid PIN' })
    }

    const token = signToken({
      hostId: host.id,
      eventId: host.eventId,
      role: 'host',
    })

    setCookie(event, 'eventiny_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 3,
      path: '/',
    })

    return { host, token }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
})

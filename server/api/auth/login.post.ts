import { z } from 'zod'
import bcrypt from 'bcryptjs'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await prisma.user.findUnique({
    where: { email: body.email },
  })

  if (!user || !user.enabled) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  // Check expiry for organizers
  if (user.expiresAt && new Date() > user.expiresAt) {
    throw createError({ statusCode: 401, statusMessage: 'Your access has expired. Please contact the administrator.' })
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const token = signToken({
    userId: user.id,
    role: user.role as 'superadmin' | 'organizer',
  })

  // Set HTTP-only cookie
  setCookie(event, 'eventiny_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  }
})

import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createOrganizerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2).max(100),
  expiresAt: z.string().datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  requireAuth(event, 'superadmin')

  const body = await readValidatedBody(event, createOrganizerSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) {
    throw createError({ statusCode: 400, statusMessage: nameResult.error })
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const passwordHash = await bcrypt.hash(body.password, 12)

  const organizer = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      role: 'organizer',
      name: nameResult.sanitized,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      enabled: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  return organizer
})

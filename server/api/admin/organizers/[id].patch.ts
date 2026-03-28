import { z } from 'zod'
import bcrypt from 'bcryptjs'

const updateOrganizerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  enabled: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  password: z.string().min(6).optional(),
})

export default defineEventHandler(async (event) => {
  requireAuth(event, 'superadmin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing organizer ID' })

  const body = await readValidatedBody(event, updateOrganizerSchema.parse)

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const nameResult = validateName(body.name)
    if (!nameResult.valid) {
      throw createError({ statusCode: 400, statusMessage: nameResult.error })
    }
    data.name = nameResult.sanitized
  }
  if (body.enabled !== undefined) data.enabled = body.enabled
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body.password !== undefined) data.passwordHash = await bcrypt.hash(body.password, 12)

  const organizer = await prisma.user.update({
    where: { id },
    data,
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

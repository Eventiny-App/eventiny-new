import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['battle', 'choreo']),
  bracketSize: z.number().int().min(2).max(128).nullable().optional(),
  battleVotingMode: z.enum(['hands', 'app']).optional().default('hands'),
  choreoBattleTop: z.number().int().min(2).max(128).nullable().optional(),
  choreoThemes: z.array(z.string().min(1).max(100)).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Missing event ID' })

  // Verify event ownership
  const ev = await prisma.event.findUnique({ where: { id: eventId } })
  if (!ev) throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  if (auth.role === 'organizer' && ev.organizerId !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Not your event' })
  }

  const body = await readValidatedBody(event, createCategorySchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) throw createError({ statusCode: 400, statusMessage: nameResult.error })

  // Get next sort order
  const maxOrder = await prisma.category.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  })

  const category = await prisma.category.create({
    data: {
      name: nameResult.sanitized,
      type: body.type,
      bracketSize: body.type === 'battle' ? (body.bracketSize ?? 16) : (body.choreoBattleTop ?? null),
      battleVotingMode: body.battleVotingMode,
      choreoBattleTop: body.type === 'choreo' ? (body.choreoBattleTop ?? null) : null,
      eventId,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      choreoThemes: body.type === 'choreo' && body.choreoThemes?.length
        ? {
            create: body.choreoThemes.map((name, i) => ({
              name: sanitizeName(name),
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: {
      choreoThemes: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { participantCategories: true, judgeCategories: true } },
    },
  })

  // Create the initial category state
  await prisma.categoryState.create({
    data: { categoryId: category.id },
  })

  return category
})

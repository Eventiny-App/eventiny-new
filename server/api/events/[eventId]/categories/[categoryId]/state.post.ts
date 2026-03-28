import { z } from 'zod'

const schema = z.object({
  action: z.enum([
    'start-preselection',
    'set-current-participant',
    'finish-preselection',
    'start-battles',
    'set-current-matchup',
    'complete',
    'back-to-ranking',
    'back-to-preselection',
    'back-to-battles',
    'reset-to-idle',
  ]),
  participantId: z.string().optional(),
  matchupId: z.string().optional(),
  timerDuration: z.number().min(10).max(600).optional(),
})

/**
 * POST /api/events/:eventId/categories/:categoryId/state
 * Host controls the category flow. Each action transitions the phase.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  const user = await requireAuth(event, 'superadmin', 'organizer', 'host')

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0].message })
  }

  const { action, participantId, matchupId, timerDuration } = parsed.data

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
    include: {
      categoryState: true,
      participantCategories: {
        where: { withdrawn: false },
        orderBy: { orderPosition: 'asc' },
        include: { participant: true },
      },
    },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const state = category.categoryState
  if (!state) {
    throw createError({ statusCode: 400, statusMessage: 'Category has no state record' })
  }

  switch (action) {
    case 'start-preselection': {
      if (state.phase !== 'idle') {
        throw createError({ statusCode: 400, statusMessage: `Cannot start preselection: current phase is "${state.phase}"` })
      }
      if (category.participantCategories.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'No participants registered in this category' })
      }

      // Randomize participant order
      const shuffled = [...category.participantCategories].sort(() => Math.random() - 0.5)
      for (let i = 0; i < shuffled.length; i++) {
        await prisma.participantCategory.update({
          where: { id: shuffled[i].id },
          data: { orderPosition: i + 1 },
        })
      }

      // Set phase to preselection, current = first participant
      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'preselection',
          currentParticipantId: shuffled[0].participantId,
          ...(timerDuration ? { timerDuration } : {}),
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'preselection' },
      })

      return { success: true, phase: 'preselection', firstParticipantId: shuffled[0].participantId }
    }

    case 'set-current-participant': {
      if (state.phase !== 'preselection') {
        throw createError({ statusCode: 400, statusMessage: 'Can only set current participant during preselection' })
      }
      if (!participantId) {
        throw createError({ statusCode: 400, statusMessage: 'participantId is required' })
      }

      // Verify this participant is in the category
      const inCategory = category.participantCategories.some(pc => pc.participantId === participantId)
      if (!inCategory) {
        throw createError({ statusCode: 400, statusMessage: 'Participant not in this category' })
      }

      await prisma.categoryState.update({
        where: { id: state.id },
        data: { currentParticipantId: participantId },
      })

      return { success: true, currentParticipantId: participantId }
    }

    case 'finish-preselection': {
      if (state.phase !== 'preselection') {
        throw createError({ statusCode: 400, statusMessage: 'Not in preselection phase' })
      }

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'ranking',
          currentParticipantId: null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'ranking' },
      })

      return { success: true, phase: 'ranking' }
    }

    case 'start-battles': {
      if (state.phase !== 'ranking' && state.phase !== 'playoffs') {
        throw createError({ statusCode: 400, statusMessage: 'Can only start battles from ranking or playoffs phase' })
      }

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'battles',
          currentParticipantId: null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'battles' },
      })

      return { success: true, phase: 'battles' }
    }

    case 'set-current-matchup': {
      if (state.phase !== 'battles') {
        throw createError({ statusCode: 400, statusMessage: 'Not in battles phase' })
      }
      if (!matchupId) {
        throw createError({ statusCode: 400, statusMessage: 'matchupId is required' })
      }

      await prisma.categoryState.update({
        where: { id: state.id },
        data: { currentMatchupId: matchupId },
      })

      return { success: true, currentMatchupId: matchupId }
    }

    case 'back-to-ranking': {
      if (state.phase !== 'battles') {
        throw createError({ statusCode: 400, statusMessage: 'Can only go back to ranking from battles phase' })
      }

      // Delete battle bracket data
      await prisma.battleVote.deleteMany({ where: { matchup: { categoryId } } })
      await prisma.battleMatchup.deleteMany({ where: { categoryId } })

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'ranking',
          currentMatchupId: null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'ranking' },
      })

      return { success: true, phase: 'ranking' }
    }

    case 'back-to-preselection': {
      if (state.phase !== 'ranking') {
        throw createError({ statusCode: 400, statusMessage: 'Can only go back to preselection from ranking phase' })
      }

      // Restore currentParticipantId to the last participant
      const lastParticipant = category.participantCategories[category.participantCategories.length - 1]

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'preselection',
          currentParticipantId: lastParticipant?.participantId || null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'preselection' },
      })

      return { success: true, phase: 'preselection' }
    }

    case 'back-to-battles': {
      if (state.phase !== 'completed') {
        throw createError({ statusCode: 400, statusMessage: 'Can only go back to battles from completed phase' })
      }

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'battles',
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'battles' },
      })

      return { success: true, phase: 'battles' }
    }

    case 'complete': {
      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'completed',
          currentParticipantId: null,
          currentMatchupId: null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'completed' },
      })

      return { success: true, phase: 'completed' }
    }

    case 'reset-to-idle': {
      // Reset everything — delete votes, matchups, reset order
      await prisma.preselectionVote.deleteMany({ where: { categoryId } })
      await prisma.choreoVote.deleteMany({ where: { categoryId } })
      await prisma.battleVote.deleteMany({ where: { matchup: { categoryId } } })
      await prisma.battleMatchup.deleteMany({ where: { categoryId } })
      await prisma.participantCategory.updateMany({
        where: { categoryId, withdrawn: true },
        data: { withdrawn: false },
      })

      await prisma.categoryState.update({
        where: { id: state.id },
        data: {
          phase: 'idle',
          currentParticipantId: null,
          currentMatchupId: null,
          currentRound: null,
        },
      })

      await prisma.category.update({
        where: { id: categoryId },
        data: { status: 'idle' },
      })

      return { success: true, phase: 'idle' }
    }

    default:
      throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
  }
})

/**
 * GET /api/events/:eventId/export
 * Returns structured JSON for client-side PDF generation.
 *
 * Query params:
 *   categories  Comma-separated category IDs to include (default: all)
 *   content     'votes' (default) | 'list' — list skips all vote queries
 *   choreoDetail 'averaged' (default) | 'full' — full populates judgeDetails[]
 */

export interface ExportRankingRow {
  rank: number
  name: string
  average: number
  judgeScores?: Record<string, number | null>
  themeAvgs?: Record<string, number>
}

export interface ExportBracketRow {
  round: number
  position: number
  p1: string
  p2: string
  winner: string
}

export interface ExportParticipantRow {
  number: number
  name: string
}

export interface ExportJudgeDetailRow {
  name: string
  themeScores: Record<string, number | null>
  average: number
}

export interface ExportJudgeDetail {
  judgeName: string
  participants: ExportJudgeDetailRow[]
}

export interface ExportCategory {
  name: string
  type: string
  phase: string
  judgeNames: string[]
  themes: string[]
  participants: ExportParticipantRow[]
  ranking: ExportRankingRow[]
  bracket: ExportBracketRow[]
  judgeDetails: ExportJudgeDetail[]
}

export interface ExportPayload {
  eventName: string
  exportedAt: string
  content: 'votes' | 'list'
  categories: ExportCategory[]
}

export default defineEventHandler(async (event) => {
  const { eventId } = event.context.params as { eventId: string }
  await requireAuth(event, 'superadmin', 'organizer')

  const query = getQuery(event)
  const categoryFilter = query.categories ? String(query.categories).split(',').filter(Boolean) : null
  const content = query.content === 'list' ? 'list' : 'votes'
  const choreoDetail = query.choreoDetail === 'full' ? 'full' : 'averaged'

  const eventData = await prisma.event.findFirst({
    where: { id: eventId },
    include: {
      categories: {
        where: categoryFilter ? { id: { in: categoryFilter } } : undefined,
        orderBy: { name: 'asc' },
        include: {
          categoryState: true,
          choreoThemes: { orderBy: { sortOrder: 'asc' } },
          participantCategories: {
            where: { withdrawn: false },
            include: { participant: { select: { id: true, name: true } } },
          },
          judgeCategories: {
            include: { judge: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  if (!eventData) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  const categories: ExportCategory[] = []

  for (const category of eventData.categories) {
    const judges = category.judgeCategories
    const judgeNames = judges.map(jc => jc.judge.name)
    const themes = category.choreoThemes
    const phase = category.categoryState?.phase || 'idle'

    // Sort participants: orderPosition asc (nulls last), then registeredAt asc
    const sortedPcs = [...category.participantCategories].sort((a, b) => {
      if (a.orderPosition === null && b.orderPosition === null) {
        return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
      }
      if (a.orderPosition === null) return 1
      if (b.orderPosition === null) return -1
      return a.orderPosition - b.orderPosition
    })

    const participants: ExportParticipantRow[] = sortedPcs.map((pc, i) => ({
      number: i + 1,
      name: pc.participant.name,
    }))

    let ranking: ExportRankingRow[] = []
    const themeNames: string[] = []
    let judgeDetails: ExportJudgeDetail[] = []

    if (content === 'votes') {
      // ── Preselection ranking ──
      if (category.type === 'battle' || (category.type === 'choreo' && themes.length === 0)) {
        const votes = await prisma.preselectionVote.findMany({
          where: { categoryId: category.id },
        })

        const rawParticipants = sortedPcs.map(pc => pc.participant)
        const rows = rawParticipants.map(p => {
          const pVotes = votes.filter(v => v.participantId === p.id)
          const average = pVotes.length > 0
            ? Math.round((pVotes.reduce((sum, v) => sum + v.score, 0) / pVotes.length) * 100) / 100
            : 0
          const judgeScores: Record<string, number | null> = {}
          for (const jc of judges) {
            const vote = pVotes.find(v => v.judgeId === jc.judgeId)
            judgeScores[jc.judge.name] = vote ? vote.score : null
          }
          return { name: p.name, average, judgeScores }
        })

        rows.sort((a, b) => b.average - a.average)
        ranking = rows.map((r, i) => ({ rank: i + 1, name: r.name, average: r.average, judgeScores: r.judgeScores }))
      } else {
        // ── Choreo with themes ──
        const votes = await prisma.choreoVote.findMany({
          where: { categoryId: category.id },
        })

        for (const t of themes) themeNames.push(t.name)

        const rawParticipants = sortedPcs.map(pc => pc.participant)
        const rows = rawParticipants.map(p => {
          const pVotes = votes.filter(v => v.participantId === p.id)
          const themeAvgs: Record<string, number> = {}

          for (const theme of themes) {
            const themeVotes = pVotes.filter(v => v.themeId === theme.id)
            themeAvgs[theme.name] = themeVotes.length > 0
              ? Math.round((themeVotes.reduce((sum, v) => sum + v.score, 0) / themeVotes.length) * 100) / 100
              : 0
          }

          const overallAvg = themes.length > 0
            ? Math.round((Object.values(themeAvgs).reduce((s, v) => s + v, 0) / themes.length) * 100) / 100
            : 0

          return { name: p.name, average: overallAvg, themeAvgs }
        })

        rows.sort((a, b) => b.average - a.average)
        ranking = rows.map((r, i) => ({ rank: i + 1, name: r.name, average: r.average, themeAvgs: r.themeAvgs }))

        // ── Full judge detail ──
        if (choreoDetail === 'full') {
          const rankOrder = ranking.map(r => r.name)
          judgeDetails = judges.map(jc => {
            const judgeParticipants: ExportJudgeDetailRow[] = rankOrder.map(participantName => {
              const pc = sortedPcs.find(p => p.participant.name === participantName)
              const themeScores: Record<string, number | null> = {}
              let scoreSum = 0
              let scoreCount = 0

              for (const theme of themes) {
                const vote = pc
                  ? votes.find(v => v.participantId === pc.participant.id && v.judgeId === jc.judgeId && v.themeId === theme.id)
                  : undefined
                const score = vote ? vote.score : null
                themeScores[theme.name] = score
                if (score !== null) { scoreSum += score; scoreCount++ }
              }

              const average = scoreCount > 0
                ? Math.round((scoreSum / scoreCount) * 100) / 100
                : 0

              return { name: participantName, themeScores, average }
            })

            return { judgeName: jc.judge.name, participants: judgeParticipants }
          })
        }
      }
    }

    // ── Bracket results (always included) ──
    const matchups = await prisma.battleMatchup.findMany({
      where: { categoryId: category.id },
      include: {
        participant1: { select: { name: true } },
        participant2: { select: { name: true } },
        winner: { select: { name: true } },
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    })

    const bracket: ExportBracketRow[] = matchups
      .filter(m => m.participant1 || m.participant2)
      .map(m => ({
        round: m.round,
        position: m.position,
        p1: m.participant1?.name || 'TBD',
        p2: m.participant2?.name || 'TBD',
        winner: m.winner?.name || '',
      }))

    categories.push({
      name: category.name,
      type: category.type,
      phase,
      judgeNames,
      themes: themeNames,
      participants,
      ranking,
      bracket,
      judgeDetails,
    })
  }

  const payload: ExportPayload = {
    eventName: eventData.name,
    exportedAt: new Date().toISOString(),
    content,
    categories,
  }

  return payload
})

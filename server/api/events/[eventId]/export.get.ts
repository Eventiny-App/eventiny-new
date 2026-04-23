/**
 * GET /api/events/:eventId/export
 * Returns structured JSON with rankings, per-judge/theme scores, and bracket results per category.
 * Intended for client-side PDF generation.
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

export interface ExportCategory {
  name: string
  type: string
  phase: string
  judgeNames: string[]
  themes: string[]
  ranking: ExportRankingRow[]
  bracket: ExportBracketRow[]
}

export interface ExportPayload {
  eventName: string
  exportedAt: string
  categories: ExportCategory[]
}

export default defineEventHandler(async (event) => {
  const { eventId } = event.context.params as { eventId: string }
  await requireAuth(event, 'superadmin', 'organizer')

  const eventData = await prisma.event.findFirst({
    where: { id: eventId },
    include: {
      categories: {
        orderBy: { name: 'asc' },
        include: {
          categoryState: true,
          choreoThemes: { orderBy: { sortOrder: 'asc' } },
          participantCategories: {
            where: { withdrawn: false },
            include: { participant: { select: { id: true, name: true } } },
            orderBy: { orderPosition: 'asc' },
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
    const participants = category.participantCategories.map(pc => pc.participant)
    const judges = category.judgeCategories
    const judgeNames = judges.map(jc => jc.judge.name)
    const themes = category.choreoThemes
    const phase = category.categoryState?.phase || 'idle'

    let ranking: ExportRankingRow[] = []
    const themeNames: string[] = []

    // ── Preselection ranking ──
    if (category.type === 'battle' || (category.type === 'choreo' && themes.length === 0)) {
      const votes = await prisma.preselectionVote.findMany({
        where: { categoryId: category.id },
      })

      const rows = participants.map(p => {
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
      // Choreo with themes
      const votes = await prisma.choreoVote.findMany({
        where: { categoryId: category.id },
      })

      for (const t of themes) themeNames.push(t.name)

      const rows = participants.map(p => {
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
    }

    // ── Bracket results ──
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
      ranking,
      bracket,
    })
  }

  const payload: ExportPayload = {
    eventName: eventData.name,
    exportedAt: new Date().toISOString(),
    categories,
  }

  return payload
})

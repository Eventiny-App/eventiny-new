/**
 * GET /api/events/:eventId/export
 * Exports all event data as CSV: rankings, per-judge scores, and bracket results for each category.
 * Returns a multi-section CSV file.
 */
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

  const lines: string[] = []

  function escapeCsv(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function addRow(...cells: (string | number | null | undefined)[]) {
    lines.push(cells.map(escapeCsv).join(','))
  }

  // Event header
  addRow('Event', eventData.name)
  addRow('Exported', new Date().toISOString())
  addRow()

  for (const category of eventData.categories) {
    const participants = category.participantCategories.map(pc => pc.participant)
    const judges = category.judgeCategories

    addRow('---')
    addRow('Category', category.name)
    addRow('Type', category.type)
    addRow('Phase', category.categoryState?.phase || 'idle')
    addRow()

    // ── Preselection / ranking ──
    if (category.type === 'battle' || (category.type === 'choreo' && category.choreoThemes.length === 0)) {
      const votes = await prisma.preselectionVote.findMany({
        where: { categoryId: category.id },
      })

      // Build ranking
      const ranking = participants.map(p => {
        const pVotes = votes.filter(v => v.participantId === p.id)
        const totalScore = pVotes.reduce((sum, v) => sum + v.score, 0)
        const judgeCount = pVotes.length
        const average = judgeCount > 0 ? totalScore / judgeCount : 0

        const judgeScoreMap: Record<string, number | null> = {}
        for (const jc of judges) {
          const vote = pVotes.find(v => v.judgeId === jc.judgeId)
          judgeScoreMap[jc.judge.name] = vote ? vote.score : null
        }

        return { name: p.name, average: Math.round(average * 100) / 100, judgeScoreMap }
      })

      ranking.sort((a, b) => b.average - a.average)

      // Header row
      const judgeNames = judges.map(jc => jc.judge.name)
      addRow('Rank', 'Participant', 'Average', ...judgeNames)

      // Data rows
      ranking.forEach((r, i) => {
        addRow(i + 1, r.name, r.average, ...judgeNames.map(jn => r.judgeScoreMap[jn]))
      })
    } else {
      // Choreo — per-theme scores
      const votes = await prisma.choreoVote.findMany({
        where: { categoryId: category.id },
      })

      const themes = category.choreoThemes

      const ranking = participants.map(p => {
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

      ranking.sort((a, b) => b.average - a.average)

      const themeNames = themes.map(t => t.name)
      addRow('Rank', 'Participant', 'Overall Avg', ...themeNames)

      ranking.forEach((r, i) => {
        addRow(i + 1, r.name, r.average, ...themeNames.map(tn => r.themeAvgs[tn]))
      })
    }

    addRow()

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

    if (matchups.length > 0) {
      addRow('Versus Bracket')
      addRow('Round', 'Position', 'Participant 1', 'Participant 2', 'Winner')

      for (const m of matchups) {
        if (m.participant1 || m.participant2) {
          addRow(
            m.round,
            m.position,
            m.participant1?.name || 'TBD',
            m.participant2?.name || 'TBD',
            m.winner?.name || '',
          )
        }
      }
      addRow()
    }
  }

  // Return as CSV download
  const csv = lines.join('\n')
  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${sanitizeFilename(eventData.name)}-export.csv"`,
  })

  return csv
})

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').substring(0, 50) || 'event'
}

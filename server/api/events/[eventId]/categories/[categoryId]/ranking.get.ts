/**
 * GET /api/events/:eventId/categories/:categoryId/ranking
 * Computes and returns the ranking for a category based on votes.
 * For battle categories: average of preselection votes across judges.
 * For choreo categories: average across all theme scores from all judges.
 */
export default defineEventHandler(async (event) => {
  const { eventId, categoryId } = event.context.params as { eventId: string; categoryId: string }
  await requireAuth(event, 'superadmin', 'organizer', 'judge', 'host')

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
    include: {
      choreoThemes: { orderBy: { sortOrder: 'asc' } },
      categoryState: true,
      participantCategories: {
        where: { withdrawn: false },
        include: { participant: { select: { id: true, name: true } } },
      },
      judgeCategories: {
        include: { judge: { select: { id: true, name: true } } },
      },
    },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const participants = category.participantCategories.map(pc => pc.participant)
  const judges = category.judgeCategories

  if (category.type === 'battle' || category.type === 'choreo' && category.choreoThemes.length === 0) {
    // Preselection voting — simple average
    const votes = await prisma.preselectionVote.findMany({
      where: { categoryId },
    })

    const ranking = participants.map(p => {
      const pVotes = votes.filter(v => v.participantId === p.id)
      const totalScore = pVotes.reduce((sum, v) => sum + v.score, 0)
      const judgeCount = pVotes.length
      const average = judgeCount > 0 ? totalScore / judgeCount : 0

      // Per-judge breakdown
      const judgeScores = judges.map(jc => {
        const vote = pVotes.find(v => v.judgeId === jc.judgeId)
        return {
          judgeId: jc.judge.id,
          judgeName: jc.judge.name,
          score: vote ? vote.score : null,
        }
      })

      return {
        participantId: p.id,
        participantName: p.name,
        averageScore: Math.round(average * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        votesReceived: judgeCount,
        judgeScores,
      }
    })

    // Sort by average descending, tie-break by total score
    ranking.sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore
      return b.totalScore - a.totalScore
    })

    // Detect ties at bracket cutoff
    const bracketSize = category.bracketSize
    let tieAtCutoff = false
    if (bracketSize && ranking.length > bracketSize) {
      const lastIn = ranking[bracketSize - 1]
      const firstOut = ranking[bracketSize]
      if (lastIn.averageScore === firstOut.averageScore) {
        tieAtCutoff = true
      }
    }

    return {
      type: 'preselection',
      ranking: ranking.map((r, i) => ({ ...r, rank: i + 1 })),
      bracketSize,
      tieAtCutoff,
      phase: category.categoryState?.phase || 'idle',
    }
  } else {
    // Choreo voting — average across all themes
    const votes = await prisma.choreoVote.findMany({
      where: { categoryId },
      include: { theme: true },
    })

    const themes = category.choreoThemes

    const ranking = participants.map(p => {
      const pVotes = votes.filter(v => v.participantId === p.id)

      // Per-theme averages
      const themeScores = themes.map(theme => {
        const themeVotes = pVotes.filter(v => v.themeId === theme.id)
        const avg = themeVotes.length > 0
          ? themeVotes.reduce((sum, v) => sum + v.score, 0) / themeVotes.length
          : 0
        return {
          themeId: theme.id,
          themeName: theme.name,
          average: Math.round(avg * 100) / 100,
          voteCount: themeVotes.length,
        }
      })

      // Overall average (average of theme averages)
      const overallAvg = themeScores.length > 0
        ? themeScores.reduce((sum, ts) => sum + ts.average, 0) / themeScores.length
        : 0

      // Per-judge breakdown (all themes combined)
      const judgeScores = judges.map(jc => {
        const jVotes = pVotes.filter(v => v.judgeId === jc.judgeId)
        const jAvg = jVotes.length > 0
          ? jVotes.reduce((sum, v) => sum + v.score, 0) / jVotes.length
          : 0
        return {
          judgeId: jc.judge.id,
          judgeName: jc.judge.name,
          averageScore: Math.round(jAvg * 100) / 100,
          voteCount: jVotes.length,
        }
      })

      return {
        participantId: p.id,
        participantName: p.name,
        averageScore: Math.round(overallAvg * 100) / 100,
        themeScores,
        judgeScores,
      }
    })

    ranking.sort((a, b) => b.averageScore - a.averageScore)

    const bracketSize = category.choreoBattleTop || null
    let tieAtCutoff = false
    if (bracketSize && ranking.length > bracketSize) {
      const lastIn = ranking[bracketSize - 1]
      const firstOut = ranking[bracketSize]
      if (lastIn.averageScore === firstOut.averageScore) {
        tieAtCutoff = true
      }
    }

    return {
      type: 'choreo',
      ranking: ranking.map((r, i) => ({ ...r, rank: i + 1 })),
      bracketSize,
      tieAtCutoff,
      themes: themes.map(t => ({ id: t.id, name: t.name })),
      phase: category.categoryState?.phase || 'idle',
    }
  }
})

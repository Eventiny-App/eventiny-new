import type { JudgeVote, RankingEntry } from "./types";

export interface RankingComputation {
  ranking: RankingEntry[];
  tieAtCutoff: boolean;
}

export function computeRanking(votes: JudgeVote[], cutoff: number): RankingComputation {
  const map = new Map<string, RankingEntry>();

  for (const vote of votes) {
    const current = map.get(vote.participantId) ?? {
      participantId: vote.participantId,
      totalScore: 0,
      judgeCount: 0
    };

    current.totalScore += vote.score;
    current.judgeCount += 1;
    map.set(vote.participantId, current);
  }

  const ranking = [...map.values()].sort((a, b) => {
    if (b.totalScore === a.totalScore) {
      return b.judgeCount - a.judgeCount;
    }

    return b.totalScore - a.totalScore;
  });

  if (cutoff <= 0 || ranking.length < cutoff) {
    return { ranking, tieAtCutoff: false };
  }

  const cutoffScore = ranking[cutoff - 1].totalScore;
  const tieAtCutoff = ranking.slice(cutoff).some((entry) => entry.totalScore === cutoffScore);

  return { ranking, tieAtCutoff };
}

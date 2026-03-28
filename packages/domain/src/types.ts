export type UserRole = "creator" | "organizer" | "host" | "judge";

export type CategoryType = "battle" | "choreographic";

export type BattleFormat = "TOP_4" | "TOP_8" | "TOP_16" | "TOP_32" | "CUSTOM";

export type CategoryState =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "STARTED_PRESELECTION"
  | "PRESELECTION_REVIEW"
  | "PRESELECTION_LOCKED"
  | "PLAYOFFS_OPTIONAL"
  | "BATTLE_BRACKET"
  | "FINALIZED"
  | "ARCHIVED";

export type VoteMethod = "HOST_MANUAL" | "JUDGE_APP";

export interface OrganizerAccess {
  organizerId: string;
  eventId: string;
  expiresAtIso: string;
  revokedAtIso?: string;
}

export interface Participant {
  id: string;
  displayName: string;
  categoryIds: string[];
  createdAtIso: string;
}

export interface JudgeVote {
  judgeId: string;
  participantId: string;
  score: number;
}

export interface RankingEntry {
  participantId: string;
  totalScore: number;
  judgeCount: number;
}

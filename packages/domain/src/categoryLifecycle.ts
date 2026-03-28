import type { CategoryState } from "./types";

const transitions: Record<CategoryState, CategoryState[]> = {
  DRAFT: ["REGISTRATION_OPEN", "ARCHIVED"],
  REGISTRATION_OPEN: ["STARTED_PRESELECTION", "ARCHIVED"],
  STARTED_PRESELECTION: ["PRESELECTION_REVIEW", "ARCHIVED"],
  PRESELECTION_REVIEW: ["PRESELECTION_LOCKED", "STARTED_PRESELECTION", "ARCHIVED"],
  PRESELECTION_LOCKED: ["PLAYOFFS_OPTIONAL", "BATTLE_BRACKET", "ARCHIVED"],
  PLAYOFFS_OPTIONAL: ["BATTLE_BRACKET", "ARCHIVED"],
  BATTLE_BRACKET: ["FINALIZED", "ARCHIVED"],
  FINALIZED: ["ARCHIVED"],
  ARCHIVED: []
};

export function canTransitionCategoryState(from: CategoryState, to: CategoryState): boolean {
  return transitions[from].includes(to);
}

export function assertCategoryStateTransition(from: CategoryState, to: CategoryState): void {
  if (!canTransitionCategoryState(from, to)) {
    throw new Error(`Invalid category state transition: ${from} -> ${to}`);
  }
}

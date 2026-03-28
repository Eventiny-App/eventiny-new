import type { OrganizerAccess, Participant } from "@eventiny/domain";

export interface OrganizerAccessRepository {
  getAccess(organizerId: string, eventId: string): Promise<OrganizerAccess | null>;
  revokeAccess(organizerId: string, eventId: string, nowIso: string): Promise<void>;
}

export interface CategoryParticipantsRepository {
  listCategoryParticipants(categoryId: string): Promise<Participant[]>;
  saveCategoryRunOrder(categoryId: string, orderedParticipantIds: string[]): Promise<void>;
  appendParticipantToRunOrder(categoryId: string, participantId: string): Promise<void>;
}

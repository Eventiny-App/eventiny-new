import type { OrganizerAccessRepository, CategoryParticipantsRepository } from "./ports";
import type { Participant } from "@eventiny/domain";

function shuffledParticipantIds(participants: Participant[]): string[] {
  const ids = participants.map((participant) => participant.id);

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids;
}

export class OrganizerAccessService {
  constructor(private readonly repository: OrganizerAccessRepository) {}

  async ensureValidAccess(organizerId: string, eventId: string, nowIso: string): Promise<void> {
    const access = await this.repository.getAccess(organizerId, eventId);
    if (!access) {
      throw new Error("Organizer access not found");
    }

    if (access.revokedAtIso) {
      throw new Error("Organizer access already revoked");
    }

    if (new Date(access.expiresAtIso).getTime() <= new Date(nowIso).getTime()) {
      await this.repository.revokeAccess(organizerId, eventId, nowIso);
      throw new Error("Organizer access expired");
    }
  }
}

export class CategoryStartService {
  constructor(private readonly repository: CategoryParticipantsRepository) {}

  async startCategoryWithRandomOrder(categoryId: string): Promise<string[]> {
    const participants = await this.repository.listCategoryParticipants(categoryId);
    const orderedIds = shuffledParticipantIds(participants);
    await this.repository.saveCategoryRunOrder(categoryId, orderedIds);
    return orderedIds;
  }

  async appendLateRegistration(categoryId: string, participantId: string): Promise<void> {
    await this.repository.appendParticipantToRunOrder(categoryId, participantId);
  }
}

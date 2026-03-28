import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  setDoc,
  arrayUnion,
  Firestore
} from "firebase/firestore";
import type { OrganizerAccessRepository, CategoryParticipantsRepository } from "@eventiny/application";
import type { OrganizerAccess, Participant } from "@eventiny/domain";

export class FirebaseOrganizerAccessRepository implements OrganizerAccessRepository {
  constructor(private readonly db: Firestore) {}

  async getAccess(organizerId: string, eventId: string): Promise<OrganizerAccess | null> {
    const accessRef = doc(this.db, "events", eventId, "organizerAccess", organizerId);
    const snapshot = await getDoc(accessRef);
    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as OrganizerAccess;
  }

  async revokeAccess(organizerId: string, eventId: string, nowIso: string): Promise<void> {
    const accessRef = doc(this.db, "events", eventId, "organizerAccess", organizerId);
    await updateDoc(accessRef, { revokedAtIso: nowIso });
  }
}

export class FirebaseCategoryParticipantsRepository implements CategoryParticipantsRepository {
  constructor(private readonly db: Firestore) {}

  async listCategoryParticipants(categoryId: string): Promise<Participant[]> {
    const participantsRef = collection(this.db, "categories", categoryId, "participants");
    const snapshot = await getDocs(participantsRef);
    return snapshot.docs.map((entry) => entry.data() as Participant);
  }

  async saveCategoryRunOrder(categoryId: string, orderedParticipantIds: string[]): Promise<void> {
    const runOrderRef = doc(this.db, "categories", categoryId, "runtime", "runOrder");
    await setDoc(runOrderRef, { orderedParticipantIds, startedAtIso: new Date().toISOString() });
  }

  async appendParticipantToRunOrder(categoryId: string, participantId: string): Promise<void> {
    const runOrderRef = doc(this.db, "categories", categoryId, "runtime", "runOrder");
    await updateDoc(runOrderRef, {
      orderedParticipantIds: arrayUnion(participantId)
    });
  }
}

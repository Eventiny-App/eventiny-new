import { useMemo, useState } from "react";
import { CategoryStartService } from "@eventiny/application";
import { computeRanking, type BattleFormat, type CategoryType, type Participant, type UserRole } from "@eventiny/domain";

interface OrganizerAccessRecord {
  organizerId: string;
  organizerName: string;
  eventId: string;
  expiresAtIso: string;
  revokedAtIso?: string;
}

interface CategoryRecord {
  id: string;
  name: string;
  type: CategoryType;
  battleFormat?: BattleFormat;
  customBattleSize?: number;
  choreoThemes?: string[];
  choreographyStartsBattleSize?: number;
  isStarted: boolean;
  runOrderParticipantIds: string[];
}

class InMemoryCategoryParticipantsRepository {
  constructor(
    private readonly categoriesRef: () => CategoryRecord[],
    private readonly participantsRef: () => Participant[],
    private readonly setCategories: React.Dispatch<React.SetStateAction<CategoryRecord[]>>
  ) {}

  async listCategoryParticipants(categoryId: string): Promise<Participant[]> {
    return this.participantsRef().filter((participant) => participant.categoryIds.includes(categoryId));
  }

  async saveCategoryRunOrder(categoryId: string, orderedParticipantIds: string[]): Promise<void> {
    this.setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              isStarted: true,
              runOrderParticipantIds: orderedParticipantIds
            }
          : category
      )
    );
  }

  async appendParticipantToRunOrder(categoryId: string, participantId: string): Promise<void> {
    this.setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              runOrderParticipantIds: [...category.runOrderParticipantIds, participantId]
            }
          : category
      )
    );
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function App() {
  const [activeRole, setActiveRole] = useState<UserRole>("creator");
  const [organizerAccess, setOrganizerAccess] = useState<OrganizerAccessRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  const [newOrganizerName, setNewOrganizerName] = useState("");
  const [newOrganizerEventId, setNewOrganizerEventId] = useState("event_2026");
  const [newOrganizerExpiryDays, setNewOrganizerExpiryDays] = useState(3);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>("battle");
  const [newBattleFormat, setNewBattleFormat] = useState<BattleFormat>("TOP_16");
  const [newBattleCustomSize, setNewBattleCustomSize] = useState(16);
  const [newChoreoThemes, setNewChoreoThemes] = useState("Originality, Technique, Style");
  const [newChoreoBattleSize, setNewChoreoBattleSize] = useState(0);

  const [newParticipantName, setNewParticipantName] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const categoryParticipantsRepo = useMemo(
    () => new InMemoryCategoryParticipantsRepository(() => categories, () => participants, setCategories),
    [categories, participants]
  );
  const categoryStartService = useMemo(() => new CategoryStartService(categoryParticipantsRepo), [categoryParticipantsRepo]);

  const filteredParticipants = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();
    if (!search) {
      return participants;
    }

    return participants.filter((participant) => {
      const nameMatch = participant.displayName.toLowerCase().includes(search);
      const categoryMatch = participant.categoryIds.some((categoryId) => {
        const category = categories.find((entry) => entry.id === categoryId);
        return category?.name.toLowerCase().includes(search) ?? false;
      });

      return nameMatch || categoryMatch;
    });
  }, [participantSearch, participants, categories]);

  const tieDemo = useMemo(
    () =>
      computeRanking(
        [
          { judgeId: "j1", participantId: "p1", score: 9 },
          { judgeId: "j2", participantId: "p1", score: 8 },
          { judgeId: "j1", participantId: "p2", score: 9 },
          { judgeId: "j2", participantId: "p2", score: 8 },
          { judgeId: "j1", participantId: "p3", score: 7 },
          { judgeId: "j2", participantId: "p3", score: 8 }
        ],
        2
      ),
    []
  );

  function createOrganizerAccess(): void {
    if (!newOrganizerName.trim()) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + newOrganizerExpiryDays * 24 * 60 * 60 * 1000);
    setOrganizerAccess((prev) => [
      {
        organizerId: newId("org"),
        organizerName: newOrganizerName.trim(),
        eventId: newOrganizerEventId.trim(),
        expiresAtIso: expiresAt.toISOString()
      },
      ...prev
    ]);
    setNewOrganizerName("");
  }

  function revokeOrganizerAccess(organizerId: string): void {
    setOrganizerAccess((prev) =>
      prev.map((record) =>
        record.organizerId === organizerId
          ? {
              ...record,
              revokedAtIso: new Date().toISOString()
            }
          : record
      )
    );
  }

  function createCategory(): void {
    if (!newCategoryName.trim()) {
      return;
    }

    const base: CategoryRecord = {
      id: newId("cat"),
      name: newCategoryName.trim(),
      type: newCategoryType,
      isStarted: false,
      runOrderParticipantIds: []
    };

    const category: CategoryRecord =
      newCategoryType === "battle"
        ? {
            ...base,
            battleFormat: newBattleFormat,
            customBattleSize: newBattleFormat === "CUSTOM" ? newBattleCustomSize : undefined
          }
        : {
            ...base,
            choreoThemes: newChoreoThemes
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
            choreographyStartsBattleSize: newChoreoBattleSize > 0 ? newChoreoBattleSize : undefined
          };

    setCategories((prev) => [category, ...prev]);
    setNewCategoryName("");
  }

  async function startCategory(categoryId: string): Promise<void> {
    await categoryStartService.startCategoryWithRandomOrder(categoryId);
  }

  async function registerParticipant(): Promise<void> {
    if (!newParticipantName.trim() || selectedCategoryIds.length === 0) {
      return;
    }

    const participant: Participant = {
      id: newId("p"),
      displayName: newParticipantName.trim(),
      categoryIds: selectedCategoryIds,
      createdAtIso: new Date().toISOString()
    };

    setParticipants((prev) => [participant, ...prev]);

    // Late registration is appended to categories that have already started.
    const startedCategories = categories.filter((category) => category.isStarted && selectedCategoryIds.includes(category.id));
    for (const category of startedCategories) {
      await categoryStartService.appendLateRegistration(category.id, participant.id);
    }

    setNewParticipantName("");
    setSelectedCategoryIds([]);
  }

  function updateParticipant(participantId: string, patch: Partial<Participant>): void {
    setParticipants((prev) => prev.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant)));
  }

  function roleButtonClass(role: UserRole): string {
    return activeRole === role ? "roleButton roleButtonActive" : "roleButton";
  }

  return (
    <main className="layout">
      <header className="hero">
        <p className="kicker">Eventiny Interactive MVP</p>
        <h1>Creator and organizer workflows are now interactive</h1>
        <p>
          This screen runs in local memory for fast iteration. Firebase repositories are already wired in the monorepo and can
          replace in-memory data in the next step without changing domain rules.
        </p>
      </header>

      <section className="roleSwitcher">
        {(["creator", "organizer", "host", "judge"] as UserRole[]).map((role) => (
          <button type="button" key={role} onClick={() => setActiveRole(role)} className={roleButtonClass(role)}>
            {role}
          </button>
        ))}
      </section>

      <section className="grid">
        <article className="card cardWide">
          <h2>Creator: Organizer Access</h2>
          {activeRole !== "creator" && <p className="muted">Switch to creator role to manage access.</p>}
          <div className="formRow">
            <input
              placeholder="Organizer name"
              value={newOrganizerName}
              onChange={(event) => setNewOrganizerName(event.target.value)}
              disabled={activeRole !== "creator"}
            />
            <input
              placeholder="Event id"
              value={newOrganizerEventId}
              onChange={(event) => setNewOrganizerEventId(event.target.value)}
              disabled={activeRole !== "creator"}
            />
            <input
              type="number"
              min={1}
              value={newOrganizerExpiryDays}
              onChange={(event) => setNewOrganizerExpiryDays(Number(event.target.value))}
              disabled={activeRole !== "creator"}
            />
            <button type="button" onClick={createOrganizerAccess} disabled={activeRole !== "creator"}>
              Create access
            </button>
          </div>

          <div className="list">
            {organizerAccess.length === 0 && <p className="muted">No organizer access records yet.</p>}
            {organizerAccess.map((record) => {
              const status = record.revokedAtIso ? "revoked" : new Date(record.expiresAtIso) < new Date() ? "expired" : "active";
              return (
                <div key={record.organizerId} className="listItem">
                  <div>
                    <strong>{record.organizerName}</strong>
                    <p className="muted">
                      Event: {record.eventId} | Expires: {new Date(record.expiresAtIso).toLocaleString()} | Status: {status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeOrganizerAccess(record.organizerId)}
                    disabled={activeRole !== "creator" || status !== "active"}
                  >
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card cardWide">
          <h2>Organizer: Categories</h2>
          {activeRole !== "organizer" && <p className="muted">Switch to organizer role to create and start categories.</p>}
          <div className="formRow">
            <input
              placeholder="Category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              disabled={activeRole !== "organizer"}
            />
            <select
              value={newCategoryType}
              onChange={(event) => setNewCategoryType(event.target.value as CategoryType)}
              disabled={activeRole !== "organizer"}
            >
              <option value="battle">Battle</option>
              <option value="choreographic">Choreographic</option>
            </select>

            {newCategoryType === "battle" ? (
              <>
                <select
                  value={newBattleFormat}
                  onChange={(event) => setNewBattleFormat(event.target.value as BattleFormat)}
                  disabled={activeRole !== "organizer"}
                >
                  <option value="TOP_4">Top 4</option>
                  <option value="TOP_8">Top 8</option>
                  <option value="TOP_16">Top 16</option>
                  <option value="TOP_32">Top 32</option>
                  <option value="CUSTOM">Custom</option>
                </select>
                {newBattleFormat === "CUSTOM" && (
                  <input
                    type="number"
                    min={2}
                    value={newBattleCustomSize}
                    onChange={(event) => setNewBattleCustomSize(Number(event.target.value))}
                    disabled={activeRole !== "organizer"}
                  />
                )}
              </>
            ) : (
              <>
                <input
                  placeholder="Themes separated by comma"
                  value={newChoreoThemes}
                  onChange={(event) => setNewChoreoThemes(event.target.value)}
                  disabled={activeRole !== "organizer"}
                />
                <input
                  type="number"
                  min={0}
                  value={newChoreoBattleSize}
                  onChange={(event) => setNewChoreoBattleSize(Number(event.target.value))}
                  disabled={activeRole !== "organizer"}
                />
              </>
            )}

            <button type="button" onClick={createCategory} disabled={activeRole !== "organizer"}>
              Add category
            </button>
          </div>

          <div className="list">
            {categories.length === 0 && <p className="muted">No categories yet.</p>}
            {categories.map((category) => (
              <div key={category.id} className="listItem listItemBlock">
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">Type: {category.type}</p>
                  {category.type === "battle" ? (
                    <p className="muted">
                      Format: {category.battleFormat}
                      {category.battleFormat === "CUSTOM" ? ` (${category.customBattleSize})` : ""}
                    </p>
                  ) : (
                    <p className="muted">Themes: {(category.choreoThemes ?? []).join(", ")}</p>
                  )}
                  <p className="muted">Run order: {category.runOrderParticipantIds.join(" > ") || "not started"}</p>
                </div>
                <button type="button" onClick={() => void startCategory(category.id)} disabled={activeRole !== "organizer"}>
                  {category.isStarted ? "Re-shuffle" : "Start category"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="card cardWide">
          <h2>Registration: Participants</h2>
          {(activeRole === "host" || activeRole === "judge") && (
            <p className="muted">Registration editing is reserved to creator/organizer in this slice.</p>
          )}
          <div className="formRow">
            <input
              placeholder="Participant or crew name"
              value={newParticipantName}
              onChange={(event) => setNewParticipantName(event.target.value)}
              disabled={activeRole === "host" || activeRole === "judge"}
            />
            <select
              multiple
              value={selectedCategoryIds}
              onChange={(event) => {
                const nextSelection = [...event.target.selectedOptions].map((entry) => entry.value);
                setSelectedCategoryIds(nextSelection);
              }}
              disabled={activeRole === "host" || activeRole === "judge"}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void registerParticipant()}
              disabled={activeRole === "host" || activeRole === "judge"}
            >
              Register
            </button>
          </div>

          <div className="formRow">
            <input
              placeholder="Search participant or category"
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
            />
          </div>

          <div className="list">
            {filteredParticipants.length === 0 && <p className="muted">No participants found.</p>}
            {filteredParticipants.map((participant) => {
              const isEditing = editingParticipantId === participant.id;
              const attachedStartedCategory = participant.categoryIds.some(
                (categoryId) => categories.find((category) => category.id === categoryId)?.isStarted
              );

              return (
                <div key={participant.id} className="listItem listItemBlock">
                  <div>
                    {isEditing ? (
                      <input
                        value={participant.displayName}
                        onChange={(event) => updateParticipant(participant.id, { displayName: event.target.value })}
                      />
                    ) : (
                      <strong>{participant.displayName}</strong>
                    )}

                    <p className="muted">
                      Categories: {participant.categoryIds.map((id) => categories.find((category) => category.id === id)?.name ?? id).join(", ")}
                    </p>
                    {attachedStartedCategory && (
                      <p className="warning">This participant is in a started category, removal is blocked by design.</p>
                    )}
                  </div>

                  <div className="actionsInline">
                    <button type="button" onClick={() => setEditingParticipantId(isEditing ? null : participant.id)}>
                      {isEditing ? "Done" : "Edit"}
                    </button>
                    <button type="button" disabled={attachedStartedCategory}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Preselection Tie Detector Demo</h2>
        <p>
          Top-2 tie warning: <strong>{tieDemo.tieAtCutoff ? "YES" : "NO"}</strong>
        </p>
        <ul>
          {tieDemo.ranking.map((entry, index) => (
            <li key={entry.participantId}>
              #{index + 1} - {entry.participantId}: {entry.totalScore} points ({entry.judgeCount} votes)
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

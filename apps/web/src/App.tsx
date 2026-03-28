import { useMemo, useState, type ReactElement } from "react";
import { CategoryStartService } from "@eventiny/application";
import { computeRanking, type BattleFormat, type CategoryType, type JudgeVote, type Participant } from "@eventiny/domain";

interface Session {
  role: "creator" | "organizer";
  organizerId?: string;
}

interface OrganizerCredential {
  id: string;
  organizerName: string;
  username: string;
  password: string;
  eventId: string;
  expiresAtIso: string;
  revokedAtIso?: string;
}

interface CategoryRecord {
  id: string;
  name: string;
  eventId: string;
  type: CategoryType;
  battleFormat?: BattleFormat;
  customBattleSize?: number;
  choreoThemes?: string[];
  choreographyStartsBattleSize?: number;
  isStarted: boolean;
  runOrderParticipantIds: string[];
}

interface SimulationResult {
  categoryId: string;
  cutoff: number;
  votes: JudgeVote[];
}

interface PersistedState {
  organizerCredentials: OrganizerCredential[];
  categories: CategoryRecord[];
  participants: Participant[];
  simulation?: SimulationResult;
}

const CREATOR_DEV_USERNAME = "creator";
const CREATOR_DEV_PASSWORD = "creator123";
const STORAGE_KEY = "eventiny-local-dev-state-v1";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        organizerCredentials: [],
        categories: [],
        participants: []
      };
    }

    const parsed = JSON.parse(raw) as PersistedState;
    return {
      organizerCredentials: parsed.organizerCredentials ?? [],
      categories: parsed.categories ?? [],
      participants: parsed.participants ?? [],
      simulation: parsed.simulation
    };
  } catch {
    return {
      organizerCredentials: [],
      categories: [],
      participants: []
    };
  }
}

function persistState(next: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

class InMemoryCategoryParticipantsRepository {
  constructor(
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

function categoryLabel(category: CategoryRecord): string {
  if (category.type === "battle") {
    return `${category.name} (${category.battleFormat}${category.battleFormat === "CUSTOM" ? `:${category.customBattleSize}` : ""})`;
  }

  return `${category.name} (choreo)`;
}

export function App() {
  const initialState = useMemo(() => loadPersistedState(), []);

  const [session, setSession] = useState<Session | null>(null);

  const [organizerCredentials, setOrganizerCredentials] = useState<OrganizerCredential[]>(initialState.organizerCredentials);
  const [categories, setCategories] = useState<CategoryRecord[]>(initialState.categories);
  const [participants, setParticipants] = useState<Participant[]>(initialState.participants);
  const [simulation, setSimulation] = useState<SimulationResult | null>(initialState.simulation ?? null);

  const [loginMode, setLoginMode] = useState<"creator" | "organizer">("creator");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

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
  const [participantSearch, setParticipantSearch] = useState("");
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  const [simulationCategoryId, setSimulationCategoryId] = useState("");
  const [simulationCutoff, setSimulationCutoff] = useState(16);

  const categoryParticipantsRepo = useMemo(
    () => new InMemoryCategoryParticipantsRepository(() => participants, setCategories),
    [participants]
  );
  const categoryStartService = useMemo(() => new CategoryStartService(categoryParticipantsRepo), [categoryParticipantsRepo]);

  const currentOrganizer = useMemo(() => {
    if (!session || session.role !== "organizer") {
      return null;
    }

    return organizerCredentials.find((entry) => entry.id === session.organizerId) ?? null;
  }, [session, organizerCredentials]);

  const organizerCategories = useMemo(() => {
    if (!currentOrganizer) {
      return [];
    }

    return categories.filter((entry) => entry.eventId === currentOrganizer.eventId);
  }, [categories, currentOrganizer]);

  const filteredParticipants = useMemo(() => {
    if (!currentOrganizer) {
      return [];
    }

    const eventCategoryIds = new Set(organizerCategories.map((category) => category.id));
    const scoped = participants.filter((participant) => participant.categoryIds.some((id) => eventCategoryIds.has(id)));

    const search = participantSearch.trim().toLowerCase();
    if (!search) {
      return scoped;
    }

    return scoped.filter((participant) => {
      const matchesName = participant.displayName.toLowerCase().includes(search);
      const matchesCategory = participant.categoryIds.some((categoryId) => {
        const category = organizerCategories.find((item) => item.id === categoryId);
        return category?.name.toLowerCase().includes(search) ?? false;
      });

      return matchesName || matchesCategory;
    });
  }, [currentOrganizer, organizerCategories, participants, participantSearch]);

  const rankingView = useMemo(() => {
    if (!simulation) {
      return null;
    }

    return computeRanking(simulation.votes, simulation.cutoff);
  }, [simulation]);

  function saveAll(next: Partial<PersistedState>): void {
    const merged: PersistedState = {
      organizerCredentials,
      categories,
      participants,
      simulation: simulation ?? undefined,
      ...next
    };

    persistState(merged);
  }

  function logout(): void {
    setSession(null);
    setLoginUsername("");
    setLoginPassword("");
    setLoginError("");
  }

  function login(): void {
    setLoginError("");

    if (loginMode === "creator") {
      if (loginUsername === CREATOR_DEV_USERNAME && loginPassword === CREATOR_DEV_PASSWORD) {
        setSession({ role: "creator" });
        return;
      }

      setLoginError("Invalid creator credentials");
      return;
    }

    const credential = organizerCredentials.find((entry) => entry.username === loginUsername && entry.password === loginPassword);
    if (!credential) {
      setLoginError("Invalid organizer credentials");
      return;
    }

    if (credential.revokedAtIso) {
      setLoginError("Organizer access was revoked by creator");
      return;
    }

    if (new Date(credential.expiresAtIso).getTime() <= Date.now()) {
      setLoginError("Organizer access is expired");
      return;
    }

    setSession({ role: "organizer", organizerId: credential.id });
  }

  function createOrganizerAccess(): void {
    if (!newOrganizerName.trim() || !newOrganizerEventId.trim()) {
      return;
    }

    const seed = newOrganizerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "organizer";
    const now = Date.now();
    const username = `${seed}_${Math.random().toString(36).slice(2, 5)}`;
    const password = Math.random().toString(36).slice(2, 10);

    const nextEntry: OrganizerCredential = {
      id: newId("org"),
      organizerName: newOrganizerName.trim(),
      username,
      password,
      eventId: newOrganizerEventId.trim(),
      expiresAtIso: new Date(now + newOrganizerExpiryDays * 24 * 60 * 60 * 1000).toISOString()
    };

    const next = [nextEntry, ...organizerCredentials];
    setOrganizerCredentials(next);
    saveAll({ organizerCredentials: next });
    setNewOrganizerName("");
  }

  function revokeOrganizerAccess(organizerId: string): void {
    const next = organizerCredentials.map((entry) =>
      entry.id === organizerId
        ? {
            ...entry,
            revokedAtIso: new Date().toISOString()
          }
        : entry
    );

    setOrganizerCredentials(next);
    saveAll({ organizerCredentials: next });
  }

  function createCategory(): void {
    if (!currentOrganizer || !newCategoryName.trim()) {
      return;
    }

    const base: CategoryRecord = {
      id: newId("cat"),
      name: newCategoryName.trim(),
      eventId: currentOrganizer.eventId,
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

    const next = [category, ...categories];
    setCategories(next);
    saveAll({ categories: next });
    setNewCategoryName("");
    if (!simulationCategoryId) {
      setSimulationCategoryId(category.id);
    }
  }

  async function startCategory(categoryId: string): Promise<void> {
    await categoryStartService.startCategoryWithRandomOrder(categoryId);
    saveAll({ categories });
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

    const nextParticipants = [participant, ...participants];
    setParticipants(nextParticipants);

    const startedCategories = organizerCategories.filter(
      (category) => category.isStarted && selectedCategoryIds.includes(category.id)
    );
    for (const category of startedCategories) {
      await categoryStartService.appendLateRegistration(category.id, participant.id);
    }

    setNewParticipantName("");
    setSelectedCategoryIds([]);
    saveAll({ participants: nextParticipants, categories });
  }

  function updateParticipant(participantId: string, patch: Partial<Participant>): void {
    const next = participants.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant));
    setParticipants(next);
    saveAll({ participants: next });
  }

  function removeParticipant(participantId: string): void {
    const participant = participants.find((entry) => entry.id === participantId);
    if (!participant) {
      return;
    }

    const inStartedCategory = participant.categoryIds.some((categoryId) => categories.find((entry) => entry.id === categoryId)?.isStarted);
    if (inStartedCategory) {
      return;
    }

    const next = participants.filter((entry) => entry.id !== participantId);
    setParticipants(next);
    saveAll({ participants: next });
  }

  function runPreselectionSimulation(): void {
    if (!simulationCategoryId) {
      return;
    }

    const categoryParticipants = participants.filter((entry) => entry.categoryIds.includes(simulationCategoryId));
    if (categoryParticipants.length === 0) {
      return;
    }

    const judgeIds = ["judge_1", "judge_2", "judge_3"];
    const votes: JudgeVote[] = [];

    for (const participant of categoryParticipants) {
      for (const judgeId of judgeIds) {
        votes.push({
          judgeId,
          participantId: participant.id,
          score: Math.floor(Math.random() * 11)
        });
      }
    }

    const nextSimulation: SimulationResult = {
      categoryId: simulationCategoryId,
      cutoff: simulationCutoff,
      votes
    };

    setSimulation(nextSimulation);
    saveAll({ simulation: nextSimulation });
  }

  function renderLogin(): ReactElement {
    return (
      <main className="layout">
        <header className="hero">
          <p className="kicker">Eventiny Local Simulation</p>
          <h1>Login</h1>
          <p>
            This local mode uses in-browser data only, so you can test full flows before Firebase deployment.
          </p>
        </header>

        <section className="card cardWide authCard">
          <div className="tabRow">
            <button
              type="button"
              className={loginMode === "creator" ? "tabButton tabButtonActive" : "tabButton"}
              onClick={() => setLoginMode("creator")}
            >
              Creator login
            </button>
            <button
              type="button"
              className={loginMode === "organizer" ? "tabButton tabButtonActive" : "tabButton"}
              onClick={() => setLoginMode("organizer")}
            >
              Organizer login
            </button>
          </div>

          {loginMode === "creator" && (
            <p className="muted">Dev credentials: creator / creator123</p>
          )}

          <div className="formCol">
            <input placeholder="Username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
            <input
              placeholder="Password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
            <button type="button" onClick={login}>
              Login
            </button>
            {loginError && <p className="errorText">{loginError}</p>}
          </div>
        </section>
      </main>
    );
  }

  function renderCreatorDashboard(): ReactElement {
    return (
      <main className="layout">
        <header className="hero headerSplit">
          <div>
            <p className="kicker">Creator Dashboard</p>
            <h1>Manage organizer credentials</h1>
            <p>Creator pages are separated from organizer pages. Organizers cannot access this area.</p>
          </div>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="grid">
          <article className="card cardWide">
            <h2>Create organizer access</h2>
            <div className="formRow">
              <input
                placeholder="Organizer name"
                value={newOrganizerName}
                onChange={(event) => setNewOrganizerName(event.target.value)}
              />
              <input
                placeholder="Event id"
                value={newOrganizerEventId}
                onChange={(event) => setNewOrganizerEventId(event.target.value)}
              />
              <input
                type="number"
                min={1}
                value={newOrganizerExpiryDays}
                onChange={(event) => setNewOrganizerExpiryDays(Number(event.target.value))}
              />
              <button type="button" onClick={createOrganizerAccess}>
                Create
              </button>
            </div>
          </article>

          <article className="card cardWide">
            <h2>Organizer credentials (share these)</h2>
            <div className="list">
              {organizerCredentials.length === 0 && <p className="muted">No organizer credentials created yet.</p>}
              {organizerCredentials.map((entry) => {
                const status = entry.revokedAtIso ? "revoked" : new Date(entry.expiresAtIso).getTime() <= Date.now() ? "expired" : "active";
                return (
                  <div key={entry.id} className="listItem listItemBlock">
                    <div>
                      <strong>{entry.organizerName}</strong>
                      <p className="muted">Event: {entry.eventId}</p>
                      <p className="mono">username: {entry.username}</p>
                      <p className="mono">password: {entry.password}</p>
                      <p className="muted">Expires: {new Date(entry.expiresAtIso).toLocaleString()}</p>
                      <p className="muted">Status: {status}</p>
                    </div>
                    <button type="button" onClick={() => revokeOrganizerAccess(entry.id)} disabled={status !== "active"}>
                      Revoke
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    );
  }

  function renderOrganizerDashboard(): ReactElement {
    if (!currentOrganizer) {
      return renderLogin();
    }

    return (
      <main className="layout">
        <header className="hero headerSplit">
          <div>
            <p className="kicker">Organizer Dashboard</p>
            <h1>{currentOrganizer.organizerName}</h1>
            <p>Event: {currentOrganizer.eventId}</p>
          </div>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="grid">
          <article className="card cardWide">
            <h2>Categories</h2>
            <div className="formRow">
              <input
                placeholder="Category name"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <select value={newCategoryType} onChange={(event) => setNewCategoryType(event.target.value as CategoryType)}>
                <option value="battle">Battle</option>
                <option value="choreographic">Choreographic</option>
              </select>

              {newCategoryType === "battle" ? (
                <>
                  <select value={newBattleFormat} onChange={(event) => setNewBattleFormat(event.target.value as BattleFormat)}>
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
                    />
                  )}
                </>
              ) : (
                <>
                  <input
                    placeholder="Themes (comma separated)"
                    value={newChoreoThemes}
                    onChange={(event) => setNewChoreoThemes(event.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    value={newChoreoBattleSize}
                    onChange={(event) => setNewChoreoBattleSize(Number(event.target.value))}
                  />
                </>
              )}

              <button type="button" onClick={createCategory}>
                Add category
              </button>
            </div>

            <div className="list">
              {organizerCategories.length === 0 && <p className="muted">No categories yet.</p>}
              {organizerCategories.map((category) => (
                <div key={category.id} className="listItem listItemBlock">
                  <div>
                    <strong>{categoryLabel(category)}</strong>
                    <p className="muted">Run order: {category.runOrderParticipantIds.join(" > ") || "not started"}</p>
                  </div>
                  <button type="button" onClick={() => void startCategory(category.id)}>
                    {category.isStarted ? "Re-shuffle" : "Start category"}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="card cardWide">
            <h2>Participants</h2>
            <div className="formRow">
              <input
                placeholder="Participant / crew name"
                value={newParticipantName}
                onChange={(event) => setNewParticipantName(event.target.value)}
              />
              <select
                multiple
                value={selectedCategoryIds}
                onChange={(event) => {
                  const next = [...event.target.selectedOptions].map((entry) => entry.value);
                  setSelectedCategoryIds(next);
                }}
              >
                {organizerCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void registerParticipant()}>
                Register
              </button>
            </div>

            <div className="formRow">
              <input
                placeholder="Search by participant or category"
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
              />
            </div>

            <div className="list">
              {filteredParticipants.length === 0 && <p className="muted">No participants for this event.</p>}
              {filteredParticipants.map((participant) => {
                const isEditing = editingParticipantId === participant.id;
                const started = participant.categoryIds.some(
                  (categoryId) => categories.find((entry) => entry.id === categoryId)?.isStarted
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
                        Categories: {participant.categoryIds.map((id) => organizerCategories.find((entry) => entry.id === id)?.name ?? id).join(", ")}
                      </p>
                      {started && <p className="warning">Removal blocked: at least one category already started.</p>}
                    </div>
                    <div className="actionsInline">
                      <button type="button" onClick={() => setEditingParticipantId(isEditing ? null : participant.id)}>
                        {isEditing ? "Done" : "Edit"}
                      </button>
                      <button type="button" onClick={() => removeParticipant(participant.id)} disabled={started}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card cardWide">
            <h2>Preselection simulation</h2>
            <p className="muted">
              This simulates judge votes for one category to test ranking and tie-at-cutoff behavior before running a real event.
            </p>
            <div className="formRow">
              <select value={simulationCategoryId} onChange={(event) => setSimulationCategoryId(event.target.value)}>
                <option value="">Select category</option>
                {organizerCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={simulationCutoff}
                onChange={(event) => setSimulationCutoff(Number(event.target.value))}
              />
              <button type="button" onClick={runPreselectionSimulation}>
                Simulate votes
              </button>
            </div>

            {!rankingView && <p className="muted">No simulation yet.</p>}
            {rankingView && simulation && (
              <div>
                <p>
                  Tie at cutoff <strong>{simulation.cutoff}</strong>: <strong>{rankingView.tieAtCutoff ? "YES" : "NO"}</strong>
                </p>
                <ul>
                  {rankingView.ranking.map((entry, index) => (
                    <li key={entry.participantId}>
                      #{index + 1} {participants.find((item) => item.id === entry.participantId)?.displayName ?? entry.participantId} - {entry.totalScore}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </section>
      </main>
    );
  }

  if (!session) {
    return renderLogin();
  }

  if (session.role === "creator") {
    return renderCreatorDashboard();
  }

  return renderOrganizerDashboard();
}

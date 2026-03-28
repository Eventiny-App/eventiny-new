import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { CategoryStartService } from "@eventiny/application";
import { computeRanking } from "@eventiny/domain";
const CREATOR_DEV_USERNAME = "creator";
const CREATOR_DEV_PASSWORD = "creator123";
const STORAGE_KEY = "eventiny-local-dev-state-v1";
function newId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
function loadPersistedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                organizerCredentials: [],
                categories: [],
                participants: []
            };
        }
        const parsed = JSON.parse(raw);
        return {
            organizerCredentials: parsed.organizerCredentials ?? [],
            categories: parsed.categories ?? [],
            participants: parsed.participants ?? [],
            simulation: parsed.simulation
        };
    }
    catch {
        return {
            organizerCredentials: [],
            categories: [],
            participants: []
        };
    }
}
function persistState(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
class InMemoryCategoryParticipantsRepository {
    participantsRef;
    setCategories;
    constructor(participantsRef, setCategories) {
        this.participantsRef = participantsRef;
        this.setCategories = setCategories;
    }
    async listCategoryParticipants(categoryId) {
        return this.participantsRef().filter((participant) => participant.categoryIds.includes(categoryId));
    }
    async saveCategoryRunOrder(categoryId, orderedParticipantIds) {
        this.setCategories((prev) => prev.map((category) => category.id === categoryId
            ? {
                ...category,
                isStarted: true,
                runOrderParticipantIds: orderedParticipantIds
            }
            : category));
    }
    async appendParticipantToRunOrder(categoryId, participantId) {
        this.setCategories((prev) => prev.map((category) => category.id === categoryId
            ? {
                ...category,
                runOrderParticipantIds: [...category.runOrderParticipantIds, participantId]
            }
            : category));
    }
}
function categoryLabel(category) {
    if (category.type === "battle") {
        return `${category.name} (${category.battleFormat}${category.battleFormat === "CUSTOM" ? `:${category.customBattleSize}` : ""})`;
    }
    return `${category.name} (choreo)`;
}
export function App() {
    const initialState = useMemo(() => loadPersistedState(), []);
    const [session, setSession] = useState(null);
    const [organizerCredentials, setOrganizerCredentials] = useState(initialState.organizerCredentials);
    const [categories, setCategories] = useState(initialState.categories);
    const [participants, setParticipants] = useState(initialState.participants);
    const [simulation, setSimulation] = useState(initialState.simulation ?? null);
    const [loginMode, setLoginMode] = useState("creator");
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [newOrganizerName, setNewOrganizerName] = useState("");
    const [newOrganizerEventId, setNewOrganizerEventId] = useState("event_2026");
    const [newOrganizerExpiryDays, setNewOrganizerExpiryDays] = useState(3);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryType, setNewCategoryType] = useState("battle");
    const [newBattleFormat, setNewBattleFormat] = useState("TOP_16");
    const [newBattleCustomSize, setNewBattleCustomSize] = useState(16);
    const [newChoreoThemes, setNewChoreoThemes] = useState("Originality, Technique, Style");
    const [newChoreoBattleSize, setNewChoreoBattleSize] = useState(0);
    const [newParticipantName, setNewParticipantName] = useState("");
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [participantSearch, setParticipantSearch] = useState("");
    const [editingParticipantId, setEditingParticipantId] = useState(null);
    const [simulationCategoryId, setSimulationCategoryId] = useState("");
    const [simulationCutoff, setSimulationCutoff] = useState(16);
    const categoryParticipantsRepo = useMemo(() => new InMemoryCategoryParticipantsRepository(() => participants, setCategories), [participants]);
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
    function saveAll(next) {
        const merged = {
            organizerCredentials,
            categories,
            participants,
            simulation: simulation ?? undefined,
            ...next
        };
        persistState(merged);
    }
    function logout() {
        setSession(null);
        setLoginUsername("");
        setLoginPassword("");
        setLoginError("");
    }
    function login() {
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
    function createOrganizerAccess() {
        if (!newOrganizerName.trim() || !newOrganizerEventId.trim()) {
            return;
        }
        const seed = newOrganizerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "organizer";
        const now = Date.now();
        const username = `${seed}_${Math.random().toString(36).slice(2, 5)}`;
        const password = Math.random().toString(36).slice(2, 10);
        const nextEntry = {
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
    function revokeOrganizerAccess(organizerId) {
        const next = organizerCredentials.map((entry) => entry.id === organizerId
            ? {
                ...entry,
                revokedAtIso: new Date().toISOString()
            }
            : entry);
        setOrganizerCredentials(next);
        saveAll({ organizerCredentials: next });
    }
    function createCategory() {
        if (!currentOrganizer || !newCategoryName.trim()) {
            return;
        }
        const base = {
            id: newId("cat"),
            name: newCategoryName.trim(),
            eventId: currentOrganizer.eventId,
            type: newCategoryType,
            isStarted: false,
            runOrderParticipantIds: []
        };
        const category = newCategoryType === "battle"
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
    async function startCategory(categoryId) {
        await categoryStartService.startCategoryWithRandomOrder(categoryId);
        saveAll({ categories });
    }
    async function registerParticipant() {
        if (!newParticipantName.trim() || selectedCategoryIds.length === 0) {
            return;
        }
        const participant = {
            id: newId("p"),
            displayName: newParticipantName.trim(),
            categoryIds: selectedCategoryIds,
            createdAtIso: new Date().toISOString()
        };
        const nextParticipants = [participant, ...participants];
        setParticipants(nextParticipants);
        const startedCategories = organizerCategories.filter((category) => category.isStarted && selectedCategoryIds.includes(category.id));
        for (const category of startedCategories) {
            await categoryStartService.appendLateRegistration(category.id, participant.id);
        }
        setNewParticipantName("");
        setSelectedCategoryIds([]);
        saveAll({ participants: nextParticipants, categories });
    }
    function updateParticipant(participantId, patch) {
        const next = participants.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant));
        setParticipants(next);
        saveAll({ participants: next });
    }
    function removeParticipant(participantId) {
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
    function runPreselectionSimulation() {
        if (!simulationCategoryId) {
            return;
        }
        const categoryParticipants = participants.filter((entry) => entry.categoryIds.includes(simulationCategoryId));
        if (categoryParticipants.length === 0) {
            return;
        }
        const judgeIds = ["judge_1", "judge_2", "judge_3"];
        const votes = [];
        for (const participant of categoryParticipants) {
            for (const judgeId of judgeIds) {
                votes.push({
                    judgeId,
                    participantId: participant.id,
                    score: Math.floor(Math.random() * 11)
                });
            }
        }
        const nextSimulation = {
            categoryId: simulationCategoryId,
            cutoff: simulationCutoff,
            votes
        };
        setSimulation(nextSimulation);
        saveAll({ simulation: nextSimulation });
    }
    function renderLogin() {
        return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero", children: [_jsx("p", { className: "kicker", children: "Eventiny Local Simulation" }), _jsx("h1", { children: "Login" }), _jsx("p", { children: "This local mode uses in-browser data only, so you can test full flows before Firebase deployment." })] }), _jsxs("section", { className: "card cardWide authCard", children: [_jsxs("div", { className: "tabRow", children: [_jsx("button", { type: "button", className: loginMode === "creator" ? "tabButton tabButtonActive" : "tabButton", onClick: () => setLoginMode("creator"), children: "Creator login" }), _jsx("button", { type: "button", className: loginMode === "organizer" ? "tabButton tabButtonActive" : "tabButton", onClick: () => setLoginMode("organizer"), children: "Organizer login" })] }), loginMode === "creator" && (_jsx("p", { className: "muted", children: "Dev credentials: creator / creator123" })), _jsxs("div", { className: "formCol", children: [_jsx("input", { placeholder: "Username", value: loginUsername, onChange: (event) => setLoginUsername(event.target.value) }), _jsx("input", { placeholder: "Password", type: "password", value: loginPassword, onChange: (event) => setLoginPassword(event.target.value) }), _jsx("button", { type: "button", onClick: login, children: "Login" }), loginError && _jsx("p", { className: "errorText", children: loginError })] })] })] }));
    }
    function renderCreatorDashboard() {
        return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero headerSplit", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Creator Dashboard" }), _jsx("h1", { children: "Manage organizer credentials" }), _jsx("p", { children: "Creator pages are separated from organizer pages. Organizers cannot access this area." })] }), _jsx("button", { type: "button", onClick: logout, children: "Logout" })] }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Create organizer access" }), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Organizer name", value: newOrganizerName, onChange: (event) => setNewOrganizerName(event.target.value) }), _jsx("input", { placeholder: "Event id", value: newOrganizerEventId, onChange: (event) => setNewOrganizerEventId(event.target.value) }), _jsx("input", { type: "number", min: 1, value: newOrganizerExpiryDays, onChange: (event) => setNewOrganizerExpiryDays(Number(event.target.value)) }), _jsx("button", { type: "button", onClick: createOrganizerAccess, children: "Create" })] })] }), _jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Organizer credentials (share these)" }), _jsxs("div", { className: "list", children: [organizerCredentials.length === 0 && _jsx("p", { className: "muted", children: "No organizer credentials created yet." }), organizerCredentials.map((entry) => {
                                            const status = entry.revokedAtIso ? "revoked" : new Date(entry.expiresAtIso).getTime() <= Date.now() ? "expired" : "active";
                                            return (_jsxs("div", { className: "listItem listItemBlock", children: [_jsxs("div", { children: [_jsx("strong", { children: entry.organizerName }), _jsxs("p", { className: "muted", children: ["Event: ", entry.eventId] }), _jsxs("p", { className: "mono", children: ["username: ", entry.username] }), _jsxs("p", { className: "mono", children: ["password: ", entry.password] }), _jsxs("p", { className: "muted", children: ["Expires: ", new Date(entry.expiresAtIso).toLocaleString()] }), _jsxs("p", { className: "muted", children: ["Status: ", status] })] }), _jsx("button", { type: "button", onClick: () => revokeOrganizerAccess(entry.id), disabled: status !== "active", children: "Revoke" })] }, entry.id));
                                        })] })] })] })] }));
    }
    function renderOrganizerDashboard() {
        if (!currentOrganizer) {
            return renderLogin();
        }
        return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero headerSplit", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Organizer Dashboard" }), _jsx("h1", { children: currentOrganizer.organizerName }), _jsxs("p", { children: ["Event: ", currentOrganizer.eventId] })] }), _jsx("button", { type: "button", onClick: logout, children: "Logout" })] }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Categories" }), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Category name", value: newCategoryName, onChange: (event) => setNewCategoryName(event.target.value) }), _jsxs("select", { value: newCategoryType, onChange: (event) => setNewCategoryType(event.target.value), children: [_jsx("option", { value: "battle", children: "Battle" }), _jsx("option", { value: "choreographic", children: "Choreographic" })] }), newCategoryType === "battle" ? (_jsxs(_Fragment, { children: [_jsxs("select", { value: newBattleFormat, onChange: (event) => setNewBattleFormat(event.target.value), children: [_jsx("option", { value: "TOP_4", children: "Top 4" }), _jsx("option", { value: "TOP_8", children: "Top 8" }), _jsx("option", { value: "TOP_16", children: "Top 16" }), _jsx("option", { value: "TOP_32", children: "Top 32" }), _jsx("option", { value: "CUSTOM", children: "Custom" })] }), newBattleFormat === "CUSTOM" && (_jsx("input", { type: "number", min: 2, value: newBattleCustomSize, onChange: (event) => setNewBattleCustomSize(Number(event.target.value)) }))] })) : (_jsxs(_Fragment, { children: [_jsx("input", { placeholder: "Themes (comma separated)", value: newChoreoThemes, onChange: (event) => setNewChoreoThemes(event.target.value) }), _jsx("input", { type: "number", min: 0, value: newChoreoBattleSize, onChange: (event) => setNewChoreoBattleSize(Number(event.target.value)) })] })), _jsx("button", { type: "button", onClick: createCategory, children: "Add category" })] }), _jsxs("div", { className: "list", children: [organizerCategories.length === 0 && _jsx("p", { className: "muted", children: "No categories yet." }), organizerCategories.map((category) => (_jsxs("div", { className: "listItem listItemBlock", children: [_jsxs("div", { children: [_jsx("strong", { children: categoryLabel(category) }), _jsxs("p", { className: "muted", children: ["Run order: ", category.runOrderParticipantIds.join(" > ") || "not started"] })] }), _jsx("button", { type: "button", onClick: () => void startCategory(category.id), children: category.isStarted ? "Re-shuffle" : "Start category" })] }, category.id)))] })] }), _jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Participants" }), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Participant / crew name", value: newParticipantName, onChange: (event) => setNewParticipantName(event.target.value) }), _jsx("select", { multiple: true, value: selectedCategoryIds, onChange: (event) => {
                                                const next = [...event.target.selectedOptions].map((entry) => entry.value);
                                                setSelectedCategoryIds(next);
                                            }, children: organizerCategories.map((category) => (_jsx("option", { value: category.id, children: categoryLabel(category) }, category.id))) }), _jsx("button", { type: "button", onClick: () => void registerParticipant(), children: "Register" })] }), _jsx("div", { className: "formRow", children: _jsx("input", { placeholder: "Search by participant or category", value: participantSearch, onChange: (event) => setParticipantSearch(event.target.value) }) }), _jsxs("div", { className: "list", children: [filteredParticipants.length === 0 && _jsx("p", { className: "muted", children: "No participants for this event." }), filteredParticipants.map((participant) => {
                                            const isEditing = editingParticipantId === participant.id;
                                            const started = participant.categoryIds.some((categoryId) => categories.find((entry) => entry.id === categoryId)?.isStarted);
                                            return (_jsxs("div", { className: "listItem listItemBlock", children: [_jsxs("div", { children: [isEditing ? (_jsx("input", { value: participant.displayName, onChange: (event) => updateParticipant(participant.id, { displayName: event.target.value }) })) : (_jsx("strong", { children: participant.displayName })), _jsxs("p", { className: "muted", children: ["Categories: ", participant.categoryIds.map((id) => organizerCategories.find((entry) => entry.id === id)?.name ?? id).join(", ")] }), started && _jsx("p", { className: "warning", children: "Removal blocked: at least one category already started." })] }), _jsxs("div", { className: "actionsInline", children: [_jsx("button", { type: "button", onClick: () => setEditingParticipantId(isEditing ? null : participant.id), children: isEditing ? "Done" : "Edit" }), _jsx("button", { type: "button", onClick: () => removeParticipant(participant.id), disabled: started, children: "Remove" })] })] }, participant.id));
                                        })] })] }), _jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Preselection simulation" }), _jsx("p", { className: "muted", children: "This simulates judge votes for one category to test ranking and tie-at-cutoff behavior before running a real event." }), _jsxs("div", { className: "formRow", children: [_jsxs("select", { value: simulationCategoryId, onChange: (event) => setSimulationCategoryId(event.target.value), children: [_jsx("option", { value: "", children: "Select category" }), organizerCategories.map((category) => (_jsx("option", { value: category.id, children: categoryLabel(category) }, category.id)))] }), _jsx("input", { type: "number", min: 1, value: simulationCutoff, onChange: (event) => setSimulationCutoff(Number(event.target.value)) }), _jsx("button", { type: "button", onClick: runPreselectionSimulation, children: "Simulate votes" })] }), !rankingView && _jsx("p", { className: "muted", children: "No simulation yet." }), rankingView && simulation && (_jsxs("div", { children: [_jsxs("p", { children: ["Tie at cutoff ", _jsx("strong", { children: simulation.cutoff }), ": ", _jsx("strong", { children: rankingView.tieAtCutoff ? "YES" : "NO" })] }), _jsx("ul", { children: rankingView.ranking.map((entry, index) => (_jsxs("li", { children: ["#", index + 1, " ", participants.find((item) => item.id === entry.participantId)?.displayName ?? entry.participantId, " - ", entry.totalScore] }, entry.participantId))) })] }))] })] })] }));
    }
    if (!session) {
        return renderLogin();
    }
    if (session.role === "creator") {
        return renderCreatorDashboard();
    }
    return renderOrganizerDashboard();
}
//# sourceMappingURL=App.js.map
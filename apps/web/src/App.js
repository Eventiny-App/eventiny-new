import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { CategoryStartService } from "@eventiny/application";
import { computeRanking } from "@eventiny/domain";
class InMemoryCategoryParticipantsRepository {
    categoriesRef;
    participantsRef;
    setCategories;
    constructor(categoriesRef, participantsRef, setCategories) {
        this.categoriesRef = categoriesRef;
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
function newId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
export function App() {
    const [activeRole, setActiveRole] = useState("creator");
    const [organizerAccess, setOrganizerAccess] = useState([]);
    const [categories, setCategories] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [participantSearch, setParticipantSearch] = useState("");
    const [editingParticipantId, setEditingParticipantId] = useState(null);
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
    const categoryParticipantsRepo = useMemo(() => new InMemoryCategoryParticipantsRepository(() => categories, () => participants, setCategories), [categories, participants]);
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
    const tieDemo = useMemo(() => computeRanking([
        { judgeId: "j1", participantId: "p1", score: 9 },
        { judgeId: "j2", participantId: "p1", score: 8 },
        { judgeId: "j1", participantId: "p2", score: 9 },
        { judgeId: "j2", participantId: "p2", score: 8 },
        { judgeId: "j1", participantId: "p3", score: 7 },
        { judgeId: "j2", participantId: "p3", score: 8 }
    ], 2), []);
    function createOrganizerAccess() {
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
    function revokeOrganizerAccess(organizerId) {
        setOrganizerAccess((prev) => prev.map((record) => record.organizerId === organizerId
            ? {
                ...record,
                revokedAtIso: new Date().toISOString()
            }
            : record));
    }
    function createCategory() {
        if (!newCategoryName.trim()) {
            return;
        }
        const base = {
            id: newId("cat"),
            name: newCategoryName.trim(),
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
        setCategories((prev) => [category, ...prev]);
        setNewCategoryName("");
    }
    async function startCategory(categoryId) {
        await categoryStartService.startCategoryWithRandomOrder(categoryId);
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
        setParticipants((prev) => [participant, ...prev]);
        // Late registration is appended to categories that have already started.
        const startedCategories = categories.filter((category) => category.isStarted && selectedCategoryIds.includes(category.id));
        for (const category of startedCategories) {
            await categoryStartService.appendLateRegistration(category.id, participant.id);
        }
        setNewParticipantName("");
        setSelectedCategoryIds([]);
    }
    function updateParticipant(participantId, patch) {
        setParticipants((prev) => prev.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant)));
    }
    function roleButtonClass(role) {
        return activeRole === role ? "roleButton roleButtonActive" : "roleButton";
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero", children: [_jsx("p", { className: "kicker", children: "Eventiny Interactive MVP" }), _jsx("h1", { children: "Creator and organizer workflows are now interactive" }), _jsx("p", { children: "This screen runs in local memory for fast iteration. Firebase repositories are already wired in the monorepo and can replace in-memory data in the next step without changing domain rules." })] }), _jsx("section", { className: "roleSwitcher", children: ["creator", "organizer", "host", "judge"].map((role) => (_jsx("button", { type: "button", onClick: () => setActiveRole(role), className: roleButtonClass(role), children: role }, role))) }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Creator: Organizer Access" }), activeRole !== "creator" && _jsx("p", { className: "muted", children: "Switch to creator role to manage access." }), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Organizer name", value: newOrganizerName, onChange: (event) => setNewOrganizerName(event.target.value), disabled: activeRole !== "creator" }), _jsx("input", { placeholder: "Event id", value: newOrganizerEventId, onChange: (event) => setNewOrganizerEventId(event.target.value), disabled: activeRole !== "creator" }), _jsx("input", { type: "number", min: 1, value: newOrganizerExpiryDays, onChange: (event) => setNewOrganizerExpiryDays(Number(event.target.value)), disabled: activeRole !== "creator" }), _jsx("button", { type: "button", onClick: createOrganizerAccess, disabled: activeRole !== "creator", children: "Create access" })] }), _jsxs("div", { className: "list", children: [organizerAccess.length === 0 && _jsx("p", { className: "muted", children: "No organizer access records yet." }), organizerAccess.map((record) => {
                                        const status = record.revokedAtIso ? "revoked" : new Date(record.expiresAtIso) < new Date() ? "expired" : "active";
                                        return (_jsxs("div", { className: "listItem", children: [_jsxs("div", { children: [_jsx("strong", { children: record.organizerName }), _jsxs("p", { className: "muted", children: ["Event: ", record.eventId, " | Expires: ", new Date(record.expiresAtIso).toLocaleString(), " | Status: ", status] })] }), _jsx("button", { type: "button", onClick: () => revokeOrganizerAccess(record.organizerId), disabled: activeRole !== "creator" || status !== "active", children: "Revoke" })] }, record.organizerId));
                                    })] })] }), _jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Organizer: Categories" }), activeRole !== "organizer" && _jsx("p", { className: "muted", children: "Switch to organizer role to create and start categories." }), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Category name", value: newCategoryName, onChange: (event) => setNewCategoryName(event.target.value), disabled: activeRole !== "organizer" }), _jsxs("select", { value: newCategoryType, onChange: (event) => setNewCategoryType(event.target.value), disabled: activeRole !== "organizer", children: [_jsx("option", { value: "battle", children: "Battle" }), _jsx("option", { value: "choreographic", children: "Choreographic" })] }), newCategoryType === "battle" ? (_jsxs(_Fragment, { children: [_jsxs("select", { value: newBattleFormat, onChange: (event) => setNewBattleFormat(event.target.value), disabled: activeRole !== "organizer", children: [_jsx("option", { value: "TOP_4", children: "Top 4" }), _jsx("option", { value: "TOP_8", children: "Top 8" }), _jsx("option", { value: "TOP_16", children: "Top 16" }), _jsx("option", { value: "TOP_32", children: "Top 32" }), _jsx("option", { value: "CUSTOM", children: "Custom" })] }), newBattleFormat === "CUSTOM" && (_jsx("input", { type: "number", min: 2, value: newBattleCustomSize, onChange: (event) => setNewBattleCustomSize(Number(event.target.value)), disabled: activeRole !== "organizer" }))] })) : (_jsxs(_Fragment, { children: [_jsx("input", { placeholder: "Themes separated by comma", value: newChoreoThemes, onChange: (event) => setNewChoreoThemes(event.target.value), disabled: activeRole !== "organizer" }), _jsx("input", { type: "number", min: 0, value: newChoreoBattleSize, onChange: (event) => setNewChoreoBattleSize(Number(event.target.value)), disabled: activeRole !== "organizer" })] })), _jsx("button", { type: "button", onClick: createCategory, disabled: activeRole !== "organizer", children: "Add category" })] }), _jsxs("div", { className: "list", children: [categories.length === 0 && _jsx("p", { className: "muted", children: "No categories yet." }), categories.map((category) => (_jsxs("div", { className: "listItem listItemBlock", children: [_jsxs("div", { children: [_jsx("strong", { children: category.name }), _jsxs("p", { className: "muted", children: ["Type: ", category.type] }), category.type === "battle" ? (_jsxs("p", { className: "muted", children: ["Format: ", category.battleFormat, category.battleFormat === "CUSTOM" ? ` (${category.customBattleSize})` : ""] })) : (_jsxs("p", { className: "muted", children: ["Themes: ", (category.choreoThemes ?? []).join(", ")] })), _jsxs("p", { className: "muted", children: ["Run order: ", category.runOrderParticipantIds.join(" > ") || "not started"] })] }), _jsx("button", { type: "button", onClick: () => void startCategory(category.id), disabled: activeRole !== "organizer", children: category.isStarted ? "Re-shuffle" : "Start category" })] }, category.id)))] })] }), _jsxs("article", { className: "card cardWide", children: [_jsx("h2", { children: "Registration: Participants" }), (activeRole === "host" || activeRole === "judge") && (_jsx("p", { className: "muted", children: "Registration editing is reserved to creator/organizer in this slice." })), _jsxs("div", { className: "formRow", children: [_jsx("input", { placeholder: "Participant or crew name", value: newParticipantName, onChange: (event) => setNewParticipantName(event.target.value), disabled: activeRole === "host" || activeRole === "judge" }), _jsx("select", { multiple: true, value: selectedCategoryIds, onChange: (event) => {
                                            const nextSelection = [...event.target.selectedOptions].map((entry) => entry.value);
                                            setSelectedCategoryIds(nextSelection);
                                        }, disabled: activeRole === "host" || activeRole === "judge", children: categories.map((category) => (_jsx("option", { value: category.id, children: category.name }, category.id))) }), _jsx("button", { type: "button", onClick: () => void registerParticipant(), disabled: activeRole === "host" || activeRole === "judge", children: "Register" })] }), _jsx("div", { className: "formRow", children: _jsx("input", { placeholder: "Search participant or category", value: participantSearch, onChange: (event) => setParticipantSearch(event.target.value) }) }), _jsxs("div", { className: "list", children: [filteredParticipants.length === 0 && _jsx("p", { className: "muted", children: "No participants found." }), filteredParticipants.map((participant) => {
                                        const isEditing = editingParticipantId === participant.id;
                                        const attachedStartedCategory = participant.categoryIds.some((categoryId) => categories.find((category) => category.id === categoryId)?.isStarted);
                                        return (_jsxs("div", { className: "listItem listItemBlock", children: [_jsxs("div", { children: [isEditing ? (_jsx("input", { value: participant.displayName, onChange: (event) => updateParticipant(participant.id, { displayName: event.target.value }) })) : (_jsx("strong", { children: participant.displayName })), _jsxs("p", { className: "muted", children: ["Categories: ", participant.categoryIds.map((id) => categories.find((category) => category.id === id)?.name ?? id).join(", ")] }), attachedStartedCategory && (_jsx("p", { className: "warning", children: "This participant is in a started category, removal is blocked by design." }))] }), _jsxs("div", { className: "actionsInline", children: [_jsx("button", { type: "button", onClick: () => setEditingParticipantId(isEditing ? null : participant.id), children: isEditing ? "Done" : "Edit" }), _jsx("button", { type: "button", disabled: attachedStartedCategory, children: "Remove" })] })] }, participant.id));
                                    })] })] })] }), _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Preselection Tie Detector Demo" }), _jsxs("p", { children: ["Top-2 tie warning: ", _jsx("strong", { children: tieDemo.tieAtCutoff ? "YES" : "NO" })] }), _jsx("ul", { children: tieDemo.ranking.map((entry, index) => (_jsxs("li", { children: ["#", index + 1, " - ", entry.participantId, ": ", entry.totalScore, " points (", entry.judgeCount, " votes)"] }, entry.participantId))) })] })] }));
}
//# sourceMappingURL=App.js.map
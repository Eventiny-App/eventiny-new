<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">Host Panel</h1>
        <UBadge variant="outline">{{ authState.name || 'Host' }}</UBadge>
      </div>
      <UButton variant="ghost" icon="i-lucide-log-out" @click="logout" class="cursor-pointer" />
    </nav>

    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <!-- Category selector -->
      <div v-if="!selectedCategoryId">
        <p class="text-sm text-gray-400 mb-4">
          Select a category to control. You can start preselections, move through participants, and advance to versus rounds.
        </p>

        <UCard v-if="loadingCategories">
          <div class="text-center py-6 text-gray-400">Loading categories…</div>
        </UCard>

        <div v-else class="space-y-3">
          <UCard v-for="cat in assignedCategories" :key="cat.id" class="cursor-pointer hover:border-green-500 transition-colors" @click="selectCategory(cat.id)">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium">{{ cat.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ cat.type === 'battle' ? 'versus' : 'choreo' }}</span>
              </div>
              <UBadge :color="phaseColor(cat.categoryState?.phase)" variant="outline">
                {{ cat.categoryState?.phase || 'idle' }}
              </UBadge>
            </div>
          </UCard>
          <p v-if="assignedCategories.length === 0" class="text-gray-500 text-center py-6">No categories assigned to you.</p>
        </div>
      </div>

      <!-- Active category control -->
      <div v-else>
        <div class="flex items-center gap-3 mb-4">
          <UButton variant="ghost" icon="i-lucide-arrow-left" @click="selectedCategoryId = null" class="cursor-pointer" />
          <h2 class="text-lg font-semibold">{{ catState?.categoryName }}</h2>
          <UBadge :color="phaseColor(catState?.phase)" variant="outline">{{ catState?.phase || 'idle' }}</UBadge>
        </div>

        <!-- IDLE phase -->
        <UCard v-if="catState?.phase === 'idle'">
          <template #header>
            <h3 class="font-semibold">Ready to Start</h3>
          </template>
          <div class="space-y-3">
            <p class="text-sm text-gray-400">
              Starting preselection will <strong>randomize the participant order</strong> and show the first dancer to all judges.
              Judges will then score each participant on their devices.
            </p>
            <p class="text-sm text-gray-400">
              <strong>{{ catState?.totalParticipants }}</strong> participants ·
              <strong>{{ catState?.totalJudges }}</strong> judges assigned
            </p>
            <UButton
              :disabled="!catState?.totalParticipants"
              @click="doAction('start-preselection')"
              :loading="actionLoading"
              class="cursor-pointer"
            >
              Start Preselection
            </UButton>
          </div>
        </UCard>

        <!-- PRESELECTION phase -->
        <div v-else-if="catState?.phase === 'preselection'" class="space-y-4">
          <!-- Current performer highlight -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Now Performing</h3>
                <span class="text-xs text-gray-500">
                  {{ currentIndex + 1 }} / {{ catState.totalParticipants }}
                </span>
              </div>
            </template>
            <div class="text-center py-4">
              <p class="text-3xl font-bold text-green-400">{{ currentParticipantName }}</p>
            </div>
          </UCard>

          <!-- Stopwatch -->
          <div class="flex items-center justify-center gap-4 py-2">
            <p class="text-3xl font-mono tabular-nums" :class="stopwatchRunning ? 'text-green-400' : 'text-gray-400'">
              {{ stopwatchDisplay }}
            </p>
            <div class="flex gap-2">
              <UButton
                v-if="!stopwatchRunning"
                size="sm"
                icon="i-lucide-play"
                @click="startStopwatch"
                class="cursor-pointer"
              >
                {{ stopwatchElapsed > 0 ? 'Resume' : 'Start' }}
              </UButton>
              <UButton
                v-else
                size="sm"
                variant="outline"
                icon="i-lucide-pause"
                @click="pauseStopwatch"
                class="cursor-pointer"
              >
                Pause
              </UButton>
              <UButton
                size="sm"
                variant="ghost"
                icon="i-lucide-rotate-ccw"
                @click="resetStopwatch"
                :disabled="stopwatchElapsed === 0 && !stopwatchRunning"
                class="cursor-pointer"
              />
            </div>
          </div>

          <!-- Navigation -->
          <div class="flex gap-3">
            <UButton
              :disabled="currentIndex <= 0"
              variant="outline"
              icon="i-lucide-chevron-left"
              @click="goToParticipant(currentIndex - 1)"
              :loading="actionLoading"
              class="cursor-pointer"
            >
              Previous
            </UButton>
            <UButton
              v-if="currentIndex < catState.totalParticipants - 1"
              icon="i-lucide-chevron-right"
              @click="goToParticipant(currentIndex + 1)"
              :loading="actionLoading"
              class="cursor-pointer"
            >
              Next Participant
            </UButton>
            <UButton
              v-else
              color="success"
              icon="i-lucide-check"
              @click="doAction('finish-preselection')"
              :loading="actionLoading"
              class="cursor-pointer"
            >
              Finish Preselection
            </UButton>
          </div>

          <!-- All participants order -->
          <UCard>
            <template #header><h3 class="font-semibold text-sm">Participant Order</h3></template>
            <div class="space-y-1">
              <div
                v-for="p in catState.participantVoteStatus"
                :key="p.participantId"
                class="flex items-center justify-between py-1 px-2 rounded text-sm"
                :class="p.participantId === catState.currentParticipantId ? 'bg-green-900/30 border border-green-700' : ''"
              >
                <span :class="p.participantId === catState.currentParticipantId ? 'text-green-400 font-medium' : 'text-gray-300'">
                  {{ p.orderPosition }}. {{ p.participantName }}
                </span>
              </div>
            </div>
          </UCard>
        </div>

        <!-- RANKING phase -->
        <UCard v-else-if="catState?.phase === 'ranking'">
          <template #header><h3 class="font-semibold">Preselection Complete — Ranking</h3></template>
          <div class="space-y-3">
            <p class="text-sm text-gray-400">
              Preselection voting is finished. View the ranking to see scores, then proceed to versus rounds
              (if configured for this category).
            </p>

            <!-- Tie resolution UI -->
            <div v-if="tieInfo" class="bg-yellow-900/20 border border-yellow-700 rounded p-3 space-y-3">
              <p class="text-sm text-yellow-400 font-medium">⚠ Tie at bracket cutoff (top {{ catState.bracketSize }})</p>
              <p class="text-xs text-yellow-300/80">
                The following dancers are tied at position {{ tieInfo.cutoffRank }}. Select exactly
                <strong>{{ tieInfo.slotsAvailable }}</strong> to fill the remaining bracket spot{{ tieInfo.slotsAvailable > 1 ? 's' : '' }}.
              </p>
              <div class="space-y-1">
                <label
                  v-for="p in tieInfo.tiedParticipants"
                  :key="p.participantId"
                  class="flex items-center gap-2 py-1 px-2 rounded text-sm cursor-pointer hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    :checked="tieSelections.has(p.participantId)"
                    @change="toggleTieSelection(p.participantId)"
                    class="accent-green-500"
                  />
                  <span>{{ p.participantName }}</span>
                  <span class="text-xs text-gray-500 ml-auto">avg {{ p.averageScore.toFixed(2) }}</span>
                </label>
              </div>
              <p class="text-xs" :class="tieSelections.size === tieInfo.slotsAvailable ? 'text-green-400' : 'text-gray-500'">
                Selected: {{ tieSelections.size }} / {{ tieInfo.slotsAvailable }}
              </p>
            </div>

            <div class="flex gap-3 flex-wrap">
              <UButton variant="outline" icon="i-lucide-arrow-left" @click="doAction('back-to-preselection')" :loading="actionLoading" class="cursor-pointer">
                Back to Preselection
              </UButton>
              <UButton variant="outline" @click="navigateTo(`/host/ranking/${selectedCategoryId}`)" class="cursor-pointer">
                View Ranking
              </UButton>
              <UButton
                v-if="catState.bracketSize"
                @click="generateBracketAndStart"
                :loading="actionLoading"
                :disabled="tieInfo && tieSelections.size !== tieInfo.slotsAvailable"
                class="cursor-pointer"
              >
                Generate Bracket & Start Versus
              </UButton>
              <p v-if="tieInfo && tieSelections.size !== tieInfo.slotsAvailable" class="text-xs text-red-400">
                Select exactly {{ tieInfo.slotsAvailable }} tied dancer{{ tieInfo.slotsAvailable > 1 ? 's' : '' }} above to proceed ({{ tieSelections.size }} selected)
              </p>
              <UButton
                v-else
                color="success"
                @click="doAction('complete')"
                :loading="actionLoading"
                class="cursor-pointer"
              >
                Mark Complete
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- BATTLES phase -->
        <div v-else-if="catState?.phase === 'battles'" class="space-y-4">
          <div class="flex gap-3 mb-2">
            <UButton variant="outline" size="sm" icon="i-lucide-arrow-left" @click="goBackToRanking" :loading="actionLoading" class="cursor-pointer">
              Back to Ranking
            </UButton>
          </div>
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Versus Bracket</h3>
                <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="loadBracket" class="cursor-pointer" />
              </div>
            </template>
            <p class="text-xs text-gray-500 mb-3">
              {{ catState.battleVotingMode === 'app' ? 'App voting: judges vote on their devices, then you confirm the winner.' : 'Hands voting: observe the crowd/panel reaction and pick the winner below.' }}
            </p>

            <!-- Current matchup highlight -->
            <div v-if="currentMatchup" class="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <p class="text-xs text-gray-500 mb-2 uppercase">Current Versus — Round {{ currentMatchup.round }}, {{ currentMatchup.bracket }}</p>
              <div class="flex items-center justify-between gap-4">
                <button
                  class="flex-1 text-center py-3 rounded-lg text-lg font-bold transition-all cursor-pointer"
                  :class="selectedWinnerId === currentMatchup.participant1?.id ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
                  @click="selectedWinnerId = currentMatchup.participant1?.id"
                >
                  {{ currentMatchup.participant1?.name || 'BYE' }}
                </button>
                <span class="text-gray-500 font-bold text-sm">VS</span>
                <button
                  class="flex-1 text-center py-3 rounded-lg text-lg font-bold transition-all cursor-pointer"
                  :class="selectedWinnerId === currentMatchup.participant2?.id ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
                  @click="selectedWinnerId = currentMatchup.participant2?.id"
                >
                  {{ currentMatchup.participant2?.name || 'BYE' }}
                </button>
              </div>

              <!-- App voting status -->
              <div v-if="catState.battleVotingMode === 'app' && currentMatchup.battleVotes?.length" class="mt-3 space-y-1">
                <p class="text-xs text-gray-500">Judge votes:</p>
                <div v-for="v in currentMatchup.battleVotes" :key="v.id" class="text-xs text-gray-400">
                  {{ v.judge.name }} → {{ v.votedParticipantId === currentMatchup.participant1?.id ? currentMatchup.participant1?.name : currentMatchup.participant2?.name }}
                </div>
              </div>

              <UButton
                block
                class="mt-4 cursor-pointer"
                :disabled="!selectedWinnerId"
                :loading="actionLoading"
                @click="confirmBattleWinner"
              >
                Confirm Winner
              </UButton>
            </div>
          </UCard>

          <!-- Matchups grouped by round -->
          <template v-for="round in matchupsByRound" :key="round.round">
            <UCard v-if="round.matchups.some((m: any) => m.participant1 || m.participant2)">
              <template #header>
                <h4 class="text-sm font-semibold uppercase">Round {{ round.round }}{{ round.isFinal ? ' — Final' : '' }}</h4>
              </template>
              <div class="space-y-2">
                <div
                  v-for="m in round.matchups.filter((m: any) => m.participant1 || m.participant2)"
                  :key="m.id"
                  class="flex items-center justify-between py-2 px-3 rounded text-sm"
                  :class="m.id === catState.currentMatchupId ? 'bg-green-900/30 border border-green-700' : 'bg-gray-900/30'"
                >
                  <div class="flex items-center gap-2 flex-1">
                    <span :class="m.winnerId === m.participant1?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                      {{ m.participant1?.name || 'TBD' }}
                    </span>
                    <span class="text-gray-600">vs</span>
                    <span :class="m.winnerId === m.participant2?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                      {{ m.participant2?.name || 'TBD' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge v-if="m.winnerId" variant="subtle" color="success" size="xs">
                      {{ m.winner?.name }}
                    </UBadge>
                    <UButton
                      v-if="m.winnerId && canUndoMatchup(m)"
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-undo-2"
                      @click="undoBattleWinner(m.id)"
                      :loading="actionLoading"
                      class="cursor-pointer text-yellow-400"
                    />
                    <UButton
                      v-if="m.participant1 && m.participant2 && !m.winnerId"
                      size="xs"
                      variant="outline"
                      @click="setCurrentMatchup(m.id)"
                      class="cursor-pointer"
                    >
                      Play
                    </UButton>
                  </div>
                </div>
              </div>
            </UCard>
          </template>

          <!-- Complete battles -->
          <UButton
            color="success"
            @click="doAction('complete')"
            :loading="actionLoading"
            class="cursor-pointer"
          >
            Finish Versus & Mark Complete
          </UButton>
        </div>

        <!-- COMPLETED phase -->
        <div v-else-if="catState?.phase === 'completed'" class="space-y-4">
          <UCard>
            <template #header><h3 class="font-semibold">Category Complete</h3></template>
            <p class="text-sm text-gray-400 mb-3">This category is finished.</p>
            <div class="flex gap-3 flex-wrap">
              <UButton variant="outline" @click="selectedCategoryId = null" class="cursor-pointer">
                Back to Categories
              </UButton>
              <UButton v-if="bracketData" variant="outline" @click="goBackToBattles" :loading="actionLoading" class="cursor-pointer">
                Back to Versus
              </UButton>
            </div>
          </UCard>

          <!-- Show bracket results if available -->
          <template v-if="bracketData" v-for="round in matchupsByRound" :key="'completed-' + round.round">
            <UCard v-if="round.matchups.some((m: any) => m.participant1 || m.participant2)">
              <template #header>
                <h4 class="text-sm font-semibold uppercase">Round {{ round.round }}{{ round.isFinal ? ' — Final' : '' }}</h4>
              </template>
              <div class="space-y-2">
                <div
                  v-for="m in round.matchups.filter((m: any) => m.participant1 || m.participant2)"
                  :key="m.id"
                  class="flex items-center justify-between py-2 px-3 rounded text-sm bg-gray-900/30"
                >
                  <div class="flex items-center gap-2 flex-1">
                    <span :class="m.winnerId === m.participant1?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                      {{ m.participant1?.name || 'TBD' }}
                    </span>
                    <span class="text-gray-600">vs</span>
                    <span :class="m.winnerId === m.participant2?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                      {{ m.participant2?.name || 'TBD' }}
                    </span>
                  </div>
                  <UBadge v-if="m.winnerId" variant="subtle" color="success" size="xs">
                    {{ m.winner?.name }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </template>
        </div>

        <!-- Reset button (always available) -->
        <div v-if="catState?.phase !== 'idle'" class="mt-6 border-t border-gray-800 pt-4">
          <UButton
            variant="ghost"
            color="error"
            size="sm"
            @click="showResetModal = true"
            :loading="actionLoading"
            class="cursor-pointer"
          >
            Reset Category to Idle (deletes all votes)
          </UButton>
        </div>
      </div>
    </div>
    <!-- Reset Confirmation Modal -->
    <UModal v-model:open="showResetModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-red-400">Reset Category to Idle</h3>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-gray-300">
              This will <strong class="text-red-400">permanently delete all votes, scores, and matchups</strong> for this category.
              This action cannot be undone.
            </p>
            <UFormField :label="`Type '${resetConfirmationText}' to confirm`">
              <UInput v-model="resetInput" :placeholder="resetConfirmationText" class="w-full" />
            </UFormField>
            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showResetModal = false; resetInput = ''" class="cursor-pointer">Cancel</UButton>
              <UButton color="error" :disabled="resetInput !== resetConfirmationText" @click="executeReset" :loading="actionLoading" class="cursor-pointer">
                Reset Category
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { state: authState, logout, fetchMe, isHost } = useAuth()

onMounted(async () => {
  await fetchMe()
  if (!isHost.value) navigateTo('/')
})

const eventId = computed(() => authState.value?.eventId || '')

// Load assigned categories
const loadingCategories = ref(true)
const allCategories = ref<any[]>([])

const assignedCategories = computed(() => allCategories.value)

async function loadCategories() {
  if (!eventId.value) return
  loadingCategories.value = true
  try {
    allCategories.value = (await $fetch(`/api/events/${eventId.value}/categories`)) as any[]
  } finally {
    loadingCategories.value = false
  }
}

onMounted(() => loadCategories())

// Category state polling
const selectedCategoryId = ref<string | null>(null)
const catState = ref<any>(null)

const stateUrl = computed(() =>
  selectedCategoryId.value
    ? `/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`
    : ''
)

const { data: polledState, stop: stopPolling, start: startPolling } = usePolling(stateUrl, {
  interval: 2500,
  immediate: false,
})

watch(polledState, (val) => {
  if (val) catState.value = val
})

async function selectCategory(catId: string) {
  selectedCategoryId.value = catId
  catState.value = null
  // Immediate fetch so host doesn't wait for first polling interval
  try {
    catState.value = await $fetch(`/api/events/${eventId.value}/categories/${catId}/state`)
  } catch { /* polling will retry */ }
  startPolling()
}

watch(selectedCategoryId, (val) => {
  if (!val) {
    stopPolling()
    loadCategories()
  }
})

// Current participant helpers
const currentIndex = computed(() => {
  if (!catState.value?.participants || !catState.value?.currentParticipantId) return 0
  return catState.value.participants.findIndex((p: any) => p.id === catState.value.currentParticipantId)
})

const currentParticipantName = computed(() => {
  if (!catState.value?.participants || currentIndex.value < 0) return '—'
  return catState.value.participants[currentIndex.value]?.name || '—'
})

const currentVoteStatus = computed(() => {
  if (!catState.value?.participantVoteStatus || !catState.value?.currentParticipantId) return null
  return catState.value.participantVoteStatus.find(
    (p: any) => p.participantId === catState.value.currentParticipantId
  )
})

// Actions
const actionLoading = ref(false)
const timerDuration = ref(60)

async function doAction(action: string, extra: Record<string, any> = {}) {
  actionLoading.value = true
  try {
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`, {
      method: 'POST',
      body: { action, timerDuration: timerDuration.value, ...extra },
    })
    // Force immediate refresh
    const fresh = await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`)
    catState.value = fresh
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Action failed')
  } finally {
    actionLoading.value = false
  }
}

async function goToParticipant(index: number) {
  const p = catState.value?.participants?.[index]
  if (!p) return
  await doAction('set-current-participant', { participantId: p.id })
}

// Reset modal
const showResetModal = ref(false)
const resetInput = ref('')

// Stopwatch
const stopwatchElapsed = ref(0) // milliseconds
const stopwatchRunning = ref(false)
let stopwatchInterval: ReturnType<typeof setInterval> | null = null
let stopwatchStart = 0

const stopwatchDisplay = computed(() => {
  const total = Math.floor(stopwatchElapsed.value / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

function startStopwatch() {
  stopwatchRunning.value = true
  stopwatchStart = Date.now() - stopwatchElapsed.value
  stopwatchInterval = setInterval(() => {
    stopwatchElapsed.value = Date.now() - stopwatchStart
  }, 1000)
}

function pauseStopwatch() {
  stopwatchRunning.value = false
  if (stopwatchInterval) { clearInterval(stopwatchInterval); stopwatchInterval = null }
}

function resetStopwatch() {
  pauseStopwatch()
  stopwatchElapsed.value = 0
}

// Auto-reset stopwatch when participant changes
watch(() => catState.value?.currentParticipantId, () => {
  resetStopwatch()
})

onUnmounted(() => {
  if (stopwatchInterval) clearInterval(stopwatchInterval)
})
const resetConfirmationText = computed(() => {
  const name = catState.value?.categoryName || 'category'
  return `reset ${name}`
})

async function executeReset() {
  if (resetInput.value !== resetConfirmationText.value) return
  await doAction('reset-to-idle')
  showResetModal.value = false
  resetInput.value = ''
}

async function goBackToRanking() {
  actionLoading.value = true
  try {
    // Delete bracket matchups and go back to ranking phase
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`, {
      method: 'POST',
      body: { action: 'back-to-ranking' },
    })
    bracketData.value = null
    const fresh = await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`)
    catState.value = fresh
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to go back')
  } finally {
    actionLoading.value = false
  }
}

function phaseColor(phase: string | undefined) {
  const map: Record<string, string> = {
    idle: 'neutral',
    preselection: 'warning',
    ranking: 'info',
    playoffs: 'info',
    battles: 'error',
    completed: 'success',
  }
  return (map[phase || 'idle'] || 'neutral') as any
}

// ─── Tie at cutoff handling ───────────────────────
const rankingData = ref<any>(null)
const tieSelections = ref(new Set<string>())

const tieInfo = computed(() => {
  const r = rankingData.value
  if (!r || !r.tieAtCutoff || !r.bracketSize) return null

  const bracketSize = r.bracketSize
  const cutoffScore = r.ranking[bracketSize - 1]?.averageScore
  const tiedParticipants = r.ranking.filter((p: any) => p.averageScore === cutoffScore)
  const firstTieIndex = r.ranking.findIndex((p: any) => p.averageScore === cutoffScore)
  const slotsAvailable = bracketSize - firstTieIndex

  return { tiedParticipants, slotsAvailable, cutoffRank: firstTieIndex + 1, firstTieIndex }
})

function toggleTieSelection(participantId: string) {
  const newSet = new Set(tieSelections.value)
  if (newSet.has(participantId)) {
    newSet.delete(participantId)
  } else {
    if (tieInfo.value && newSet.size >= tieInfo.value.slotsAvailable) return
    newSet.add(participantId)
  }
  tieSelections.value = newSet
}

// Load ranking data when entering ranking phase to detect ties
watch(() => catState.value?.phase, async (phase) => {
  if (phase === 'ranking' && eventId.value && selectedCategoryId.value) {
    try {
      rankingData.value = await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/ranking`)
      tieSelections.value = new Set()
    } catch { /* ignore */ }
  } else {
    rankingData.value = null
  }
})

// ─── Battle bracket ───────────────────────────────

const bracketData = ref<any>(null)
const selectedWinnerId = ref<string | null>(null)

const bracketMatchups = computed(() => {
  if (!bracketData.value) return { winners: [] }
  return {
    winners: bracketData.value.winners || [],
  }
})

const currentMatchup = computed(() => {
  if (!catState.value?.currentMatchupId || !bracketData.value) return null
  return bracketData.value.all?.find((m: any) => m.id === catState.value.currentMatchupId) || null
})

async function loadBracket() {
  if (!selectedCategoryId.value || !eventId.value) return
  try {
    bracketData.value = await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/bracket`)
  } catch {
    // No bracket yet
  }
}

// Auto-load bracket when entering battles or completed phase
watch(() => catState.value?.phase, (phase) => {
  if (phase === 'battles' || phase === 'completed') loadBracket()
})

async function generateBracketAndStart() {
  actionLoading.value = true
  try {
    // Get ranking to determine which participants enter the bracket
    const ranking = await $fetch<any>(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/ranking`)
    const bracketSize = catState.value?.bracketSize || ranking.bracketSize || 8

    // Check if any votes were actually cast
    const totalVotes = ranking.ranking.reduce((sum: number, r: any) => sum + (r.votesReceived || 0), 0)
    if (totalVotes === 0) {
      alert('No judge votes have been recorded yet. Go back and ensure judges have time to vote before generating the bracket.')
      return
    }

    // If there's a tie at cutoff, the user must have resolved it via tie selection
    if (ranking.tieAtCutoff && tieInfo.value) {
      if (tieSelections.value.size !== tieInfo.value.slotsAvailable) {
        alert(`Select exactly ${tieInfo.value.slotsAvailable} tied dancer(s) to fill the remaining bracket spot(s).`)
        return
      }
      // Build final participant list: clear qualifiers + manually selected tied ones
      const topParticipants = ranking.ranking
        .slice(0, tieInfo.value.firstTieIndex)
        .map((r: any) => r.participantId)
      for (const pid of tieSelections.value) {
        topParticipants.push(pid)
      }

      await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/bracket`, {
        method: 'POST',
        body: { participantIds: topParticipants },
      })
    } else {
      const topParticipants = ranking.ranking.slice(0, bracketSize).map((r: any) => r.participantId)

      await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/bracket`, {
        method: 'POST',
        body: { participantIds: topParticipants },
      })
    }

    // Transition to battles phase
    await doAction('start-battles')
    await loadBracket()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to generate bracket')
  } finally {
    actionLoading.value = false
  }
}

async function setCurrentMatchup(matchupId: string) {
  selectedWinnerId.value = null
  await doAction('set-current-matchup', { matchupId })
  await loadBracket()
}

async function confirmBattleWinner() {
  if (!selectedWinnerId.value || !catState.value?.currentMatchupId) return
  actionLoading.value = true
  try {
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/matchups/${catState.value.currentMatchupId}/winner`, {
      method: 'POST',
      body: { winnerId: selectedWinnerId.value },
    })
    selectedWinnerId.value = null
    await loadBracket()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to set winner')
  } finally {
    actionLoading.value = false
  }
}

// Group matchups by round for display
const matchupsByRound = computed(() => {
  const matchups = bracketMatchups.value.winners
  if (!matchups.length) return []
  const rounds = new Map<number, any[]>()
  for (const m of matchups) {
    if (!rounds.has(m.round)) rounds.set(m.round, [])
    rounds.get(m.round)!.push(m)
  }
  const maxRound = Math.max(...rounds.keys())
  return Array.from(rounds.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, ms]) => ({ round, matchups: ms, isFinal: round === maxRound && ms.length === 1 }))
})

// Check if a matchup winner can be undone (next round matchup hasn't been played yet)
function canUndoMatchup(m: any) {
  if (!m.winnerId) return false
  const nextRound = m.round + 1
  const nextPosition = Math.ceil(m.position / 2)
  const nextMatchup = bracketMatchups.value.winners.find(
    (nm: any) => nm.round === nextRound && nm.position === nextPosition
  )
  // Can undo if there's no next matchup (final) or next matchup has no winner yet
  return !nextMatchup || !nextMatchup.winnerId
}

async function undoBattleWinner(matchupId: string) {
  actionLoading.value = true
  try {
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/matchups/${matchupId}/undo-winner`, {
      method: 'POST',
    })
    await loadBracket()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to undo winner')
  } finally {
    actionLoading.value = false
  }
}

async function goBackToBattles() {
  actionLoading.value = true
  try {
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`, {
      method: 'POST',
      body: { action: 'back-to-battles' },
    })
    const fresh = await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`)
    catState.value = fresh
    await loadBracket()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to go back')
  } finally {
    actionLoading.value = false
  }
}
</script>

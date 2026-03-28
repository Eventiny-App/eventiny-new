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
          Select a category to control. You can start preselections, move through participants, and advance to battles.
        </p>

        <UCard v-if="loadingCategories">
          <div class="text-center py-6 text-gray-400">Loading categories…</div>
        </UCard>

        <div v-else class="space-y-3">
          <UCard v-for="cat in assignedCategories" :key="cat.id" class="cursor-pointer hover:border-green-500 transition-colors" @click="selectCategory(cat.id)">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium">{{ cat.name }}</span>
                <UBadge :color="cat.type === 'battle' ? 'error' : 'info'" variant="subtle" class="ml-2">{{ cat.type }}</UBadge>
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
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-400">Timer per performer:</span>
              <UInput v-model.number="timerDuration" type="number" min="10" max="600" class="w-24" />
              <span class="text-xs text-gray-500">seconds (advisory, you advance manually)</span>
            </div>
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
              <p class="text-sm text-gray-500 mt-2">Timer: {{ catState.timerDuration }}s (advance when ready)</p>
            </div>
          </UCard>

          <!-- Vote progress -->
          <UCard>
            <template #header><h3 class="font-semibold text-sm">Judge Votes for Current Performer</h3></template>
            <div class="space-y-2">
              <div v-for="jv in currentVoteStatus?.judgeVotes" :key="jv.judgeId" class="flex items-center justify-between">
                <span class="text-sm">{{ jv.judgeName }}</span>
                <UBadge :color="jv.hasVoted ? 'success' : 'neutral'" variant="subtle">
                  {{ jv.hasVoted ? 'Voted' : 'Waiting…' }}
                </UBadge>
              </div>
            </div>
          </UCard>

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

          <!-- All participants progress overview -->
          <UCard>
            <template #header><h3 class="font-semibold text-sm">All Participants Progress</h3></template>
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
                <UBadge :color="p.allJudgesVoted ? 'success' : 'neutral'" variant="subtle" size="xs">
                  {{ p.allJudgesVoted ? 'Complete' : 'Pending' }}
                </UBadge>
              </div>
            </div>
          </UCard>
        </div>

        <!-- RANKING phase -->
        <UCard v-else-if="catState?.phase === 'ranking'">
          <template #header><h3 class="font-semibold">Preselection Complete — Ranking</h3></template>
          <div class="space-y-3">
            <p class="text-sm text-gray-400">
              Preselection voting is finished. View the ranking to see scores, then proceed to battles
              (if configured for this category).
            </p>
            <div class="flex gap-3 flex-wrap">
              <UButton variant="outline" @click="navigateTo(`/host/ranking/${selectedCategoryId}`)" class="cursor-pointer">
                View Ranking
              </UButton>
              <UButton
                v-if="catState.bracketSize"
                @click="generateBracketAndStart"
                :loading="actionLoading"
                class="cursor-pointer"
              >
                Generate Bracket & Start Battles
              </UButton>
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
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Battle Bracket</h3>
                <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="loadBracket" class="cursor-pointer" />
              </div>
            </template>
            <p class="text-xs text-gray-500 mb-3">
              {{ catState.battleVotingMode === 'app' ? 'App voting: judges vote on their devices, then you confirm the winner.' : 'Hands voting: observe the crowd/panel reaction and pick the winner below.' }}
            </p>

            <!-- Current matchup highlight -->
            <div v-if="currentMatchup" class="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <p class="text-xs text-gray-500 mb-2 uppercase">Current Battle — Round {{ currentMatchup.round }}, {{ currentMatchup.bracket }}</p>
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

          <!-- All matchups by round -->
          <UCard v-show="bracketMatchups.winners?.length">
            <template #header>
              <h4 class="text-sm font-semibold uppercase">Bracket</h4>
            </template>
            <div class="space-y-2">
              <div
                v-for="m in bracketMatchups.winners"
                :key="m.id"
                class="flex items-center justify-between py-2 px-3 rounded text-sm"
                :class="m.id === catState.currentMatchupId ? 'bg-green-900/30 border border-green-700' : 'bg-gray-900/30'"
              >
                <div class="flex items-center gap-2 flex-1">
                  <span class="text-xs text-gray-500">R{{ m.round }}.{{ m.position }}</span>
                  <span :class="m.winnerId === m.participant1?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                    {{ m.participant1?.name || '—' }}
                  </span>
                  <span class="text-gray-600">vs</span>
                  <span :class="m.winnerId === m.participant2?.id ? 'text-green-400 font-bold' : 'text-gray-300'">
                    {{ m.participant2?.name || '—' }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge v-if="m.winnerId" variant="subtle" color="success" size="xs">
                    {{ m.winner?.name }}
                  </UBadge>
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

          <!-- Complete battles -->
          <UButton
            color="success"
            @click="doAction('complete')"
            :loading="actionLoading"
            class="cursor-pointer"
          >
            Finish Battles & Mark Complete
          </UButton>
        </div>

        <!-- COMPLETED phase -->
        <UCard v-else-if="catState?.phase === 'completed'">
          <template #header><h3 class="font-semibold">Category Complete</h3></template>
          <p class="text-sm text-gray-400 mb-3">This category is finished.</p>
          <UButton variant="outline" @click="selectedCategoryId = null" class="cursor-pointer">
            Back to Categories
          </UButton>
        </UCard>

        <!-- Reset button (always available) -->
        <div v-if="catState?.phase !== 'idle'" class="mt-6 border-t border-gray-800 pt-4">
          <UButton
            variant="ghost"
            color="error"
            size="sm"
            @click="confirmReset"
            :loading="actionLoading"
            class="cursor-pointer"
          >
            Reset Category to Idle (deletes all votes)
          </UButton>
        </div>
      </div>
    </div>
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

function selectCategory(catId: string) {
  selectedCategoryId.value = catId
  catState.value = null
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

async function confirmReset() {
  if (!confirm('Reset this category to idle? This will DELETE all votes and matchups. This cannot be undone.')) return
  await doAction('reset-to-idle')
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

// Auto-load bracket when entering battles phase
watch(() => catState.value?.phase, (phase) => {
  if (phase === 'battles') loadBracket()
})

async function generateBracketAndStart() {
  actionLoading.value = true
  try {
    // Get ranking to determine which participants enter the bracket
    const ranking = await $fetch<any>(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/ranking`)
    const bracketSize = catState.value?.bracketSize || ranking.bracketSize || 8
    const topParticipants = ranking.ranking.slice(0, bracketSize).map((r: any) => r.participantId)

    // Generate bracket
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/bracket`, {
      method: 'POST',
      body: { participantIds: topParticipants },
    })

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
</script>

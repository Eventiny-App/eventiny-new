<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">Judge Panel</h1>
        <UBadge variant="outline">{{ authState.name || 'Judge' }}</UBadge>
      </div>
      <UButton variant="ghost" icon="i-lucide-log-out" @click="logout" class="cursor-pointer" />
    </nav>

    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <!-- Category selector -->
      <div v-if="!selectedCategoryId">
        <p class="text-sm text-gray-400 mb-4">
          Select a category to start voting. Wait for the host to start the preselection before scoring.
        </p>

        <div class="space-y-3">
          <UCard
            v-for="cat in assignedCategories"
            :key="cat.id"
            class="cursor-pointer hover:border-green-500 transition-colors"
            @click="selectCategory(cat.id)"
          >
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium">{{ cat.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ cat.type === 'battle' ? 'versus' : 'choreo' }}</span>
              </div>
              <UBadge :color="phaseColor(cat.categoryState?.phase)" variant="outline">
                {{ formatPhase(cat.categoryState?.phase) }}
              </UBadge>
            </div>
          </UCard>
          <p v-if="assignedCategories.length === 0" class="text-gray-500 text-center py-6">No categories assigned to you.</p>
        </div>
      </div>

      <!-- Active category voting -->
      <div v-else>
        <div class="flex items-center gap-3 mb-4">
          <UButton variant="ghost" icon="i-lucide-arrow-left" @click="selectedCategoryId = null" class="cursor-pointer" />
          <h2 class="text-lg font-semibold">{{ catState?.categoryName }}</h2>
          <UBadge :color="phaseColor(catState?.phase)" variant="outline">{{ formatPhase(catState?.phase) }}</UBadge>
        </div>

        <!-- Waiting for preselection to start -->
        <UCard v-if="catState?.phase === 'idle'">
          <div class="text-center py-8">
            <p class="text-gray-400 text-lg">Waiting for the host to start preselection…</p>
            <p class="text-xs text-gray-500 mt-2">This page auto-refreshes every few seconds.</p>
          </div>
        </UCard>

        <!-- PRESELECTION voting -->
        <div v-else-if="catState?.phase === 'preselection'" class="space-y-4">
          <!-- Host indicator -->
          <div v-if="catState.currentParticipantId" class="bg-yellow-900/20 border border-yellow-700 rounded p-2 flex items-center justify-between">
            <p class="text-xs text-yellow-400">
              <span class="font-medium">Host is on:</span> {{ hostCurrentName }}
              ({{ hostCurrentIndex + 1 }}/{{ catState.totalParticipants }})
            </p>
            <UButton
              v-if="judgeSelectedParticipantId !== catState.currentParticipantId"
              size="xs"
              variant="ghost"
              @click="judgeSelectedParticipantId = catState.currentParticipantId"
              class="cursor-pointer text-yellow-400"
            >
              Jump there
            </UButton>
          </div>

          <!-- Score input for selected participant -->
          <UCard v-if="judgeSelectedParticipantId">
            <template #header>
              <h3 class="font-semibold">
                {{ catState.type === 'choreo' ? 'Score by Theme' : 'Your Score' }}
              </h3>
            </template>

            <p class="text-center text-2xl font-bold text-green-400 mb-4">{{ judgeSelectedName }}</p>

            <!-- Battle preselection: single score -->
            <div v-if="catState.type !== 'choreo' || catState.themes.length === 0" class="space-y-4">
              <div class="text-center">
                <p class="text-5xl font-bold mb-2" :class="currentScore !== null ? 'text-green-400' : 'text-gray-600'">
                  {{ currentScore !== null ? currentScore.toFixed(1) : '—' }}
                </p>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  :value="currentScore ?? 5"
                  @input="(e: any) => currentScore = parseFloat(e.target.value)"
                  class="w-full h-3 accent-green-500"
                />
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span><span>5</span><span>10</span>
                </div>
              </div>
              <UButton
                block
                :disabled="currentScore === null"
                :loading="submitting"
                @click="submitPreselectionVote"
                class="cursor-pointer"
              >
                {{ myVotes[judgeSelectedParticipantId] !== undefined ? 'Update Score' : 'Submit Score' }}
              </UButton>
              <p v-if="myVotes[judgeSelectedParticipantId] !== undefined" class="text-xs text-green-400 text-center">
                You scored {{ myVotes[judgeSelectedParticipantId] }}
              </p>
            </div>

            <!-- Choreo: score per theme -->
            <div v-else class="space-y-4">
              <div v-for="theme in catState.themes" :key="theme.id" class="space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ theme.name }}</span>
                  <span class="text-sm font-bold" :class="themeScores[theme.id] !== undefined ? 'text-green-400' : 'text-gray-600'">
                    {{ themeScores[theme.id] !== undefined ? themeScores[theme.id].toFixed(1) : '—' }}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  :value="themeScores[theme.id] ?? 5"
                  @input="(e: any) => themeScores[theme.id] = parseFloat(e.target.value)"
                  class="w-full h-2 accent-green-500"
                />
                <div class="flex justify-between text-xs text-gray-500">
                  <span>0</span><span>5</span><span>10</span>
                </div>
              </div>
              <UButton
                block
                :loading="submitting"
                @click="submitChoreoVote"
                class="cursor-pointer"
              >
                {{ hasChoreoVote ? 'Update Scores' : 'Submit Scores' }}
              </UButton>
              <p v-if="hasChoreoVote" class="text-xs text-green-400 text-center">Scores submitted</p>
            </div>
          </UCard>

          <!-- Participant selector -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-sm">Select Participant</h3>
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    variant="outline"
                    icon="i-lucide-chevron-left"
                    :disabled="judgeSelectedIndex <= 0"
                    @click="judgeSelectedParticipantId = catState.participants[judgeSelectedIndex - 1]?.id"
                    class="cursor-pointer"
                  />
                  <UButton
                    size="xs"
                    variant="outline"
                    icon="i-lucide-chevron-right"
                    :disabled="judgeSelectedIndex >= catState.participants.length - 1"
                    @click="judgeSelectedParticipantId = catState.participants[judgeSelectedIndex + 1]?.id"
                    class="cursor-pointer"
                  />
                </div>
              </div>
            </template>
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <button
                v-for="p in catState.participants"
                :key="p.id"
                class="w-full flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors cursor-pointer"
                :class="[
                  p.id === judgeSelectedParticipantId ? 'bg-green-900/40 border border-green-600' : 'hover:bg-gray-800',
                  p.id === catState.currentParticipantId && p.id !== judgeSelectedParticipantId ? 'border border-yellow-700/50' : '',
                ]"
                @click="judgeSelectedParticipantId = p.id"
              >
                <span class="flex items-center gap-2">
                  <span v-if="p.id === catState.currentParticipantId" class="text-yellow-400 text-xs" title="Host is here">●</span>
                  <span :class="p.id === judgeSelectedParticipantId ? 'text-green-400 font-medium' : 'text-gray-300'">
                    {{ p.orderPosition }}. {{ p.name }}
                  </span>
                </span>
                <span v-if="getMyScoreForParticipant(p.id) !== null" class="text-green-400 font-mono text-xs">
                  {{ getMyScoreForParticipant(p.id) }}
                </span>
                <span v-else class="text-gray-600 text-xs">—</span>
              </button>
            </div>
          </UCard>
        </div>

        <!-- Ranking / completed -->
        <UCard v-else-if="catState?.phase === 'ranking' || catState?.phase === 'completed'">
          <div class="text-center py-8">
            <p class="text-lg text-gray-300">
              {{ catState.phase === 'ranking' ? 'Preselection finished. Ranking is being reviewed.' : 'Category is complete.' }}
            </p>
            <UButton variant="outline" class="mt-4 cursor-pointer" @click="selectedCategoryId = null">
              Back to Categories
            </UButton>
          </div>
        </UCard>

        <!-- Battles phase — judge votes on matchups (app mode) -->
        <div v-else-if="catState?.phase === 'battles'" class="space-y-4">
          <UCard v-if="catState.battleVotingMode !== 'app'">
            <div class="text-center py-8">
              <p class="text-lg text-gray-300">This category uses hand voting.</p>
              <p class="text-sm text-gray-500">The host will determine battle winners based on the panel's reaction.</p>
            </div>
          </UCard>

          <template v-else>
            <UCard v-if="!currentBattleMatchup">
              <div class="text-center py-8">
                <p class="text-gray-400">Waiting for the host to start a battle matchup…</p>
                <p class="text-xs text-gray-500">This page auto-refreshes.</p>
              </div>
            </UCard>

            <UCard v-else>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold">Vote: Who Won?</h3>
                  <span class="text-xs text-gray-500">Round {{ currentBattleMatchup.round }}</span>
                </div>
              </template>

              <div class="flex gap-4">
                <button
                  class="flex-1 text-center py-6 rounded-lg text-xl font-bold transition-all cursor-pointer"
                  :class="battleVote === currentBattleMatchup.participant1?.id ? 'bg-green-600 text-white scale-105' : 'bg-blue-800 text-blue-100 hover:bg-blue-700'"
                  @click="battleVote = currentBattleMatchup.participant1?.id"
                >
                  {{ currentBattleMatchup.participant1?.name || '—' }}
                </button>
                <button
                  class="flex-1 text-center py-6 rounded-lg text-xl font-bold transition-all cursor-pointer"
                  :class="battleVote === currentBattleMatchup.participant2?.id ? 'bg-green-600 text-white scale-105' : 'bg-orange-800 text-orange-100 hover:bg-orange-700'"
                  @click="battleVote = currentBattleMatchup.participant2?.id"
                >
                  {{ currentBattleMatchup.participant2?.name || '—' }}
                </button>
              </div>

              <button
                class="w-full mt-3 text-center py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                :class="battleVote === 'tie' ? 'bg-green-600 text-white scale-[1.02]' : 'bg-yellow-800 text-yellow-100 hover:bg-yellow-700'"
                @click="battleVote = 'tie'"
              >
                Tie
              </button>

              <UButton
                block
                class="mt-4 cursor-pointer"
                :disabled="!battleVote"
                :loading="submitting"
                @click="submitBattleVote"
              >
                {{ battleVoteSubmitted ? 'Change Vote' : 'Submit Vote' }}
              </UButton>

              <div v-if="battleVoteSubmitted" class="mt-2 text-center space-y-1">
                <p class="text-xs text-green-400">Vote submitted!</p>
                <template v-if="battleVoteResult?.autoResolved">
                  <p class="text-xs text-green-300 font-medium">
                    Battle resolved! Winner: {{ battleVoteResult.winnerId === currentBattleMatchup.participant1?.id ? currentBattleMatchup.participant1?.name : currentBattleMatchup.participant2?.name }}
                  </p>
                </template>
                <template v-else-if="battleVoteResult?.tied">
                  <p class="text-xs text-yellow-400 font-medium">Tie detected — waiting for host to restart the battle.</p>
                </template>
                <template v-else-if="battleVoteResult?.allVoted === false">
                  <p class="text-xs text-gray-500">Waiting for other judges… ({{ battleVoteResult.totalVoted }}/{{ battleVoteResult.totalAssigned }})</p>
                </template>
              </div>
            </UCard>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { state: authState, logout, fetchMe, isJudge } = useAuth()

onMounted(async () => {
  await fetchMe()
  if (!isJudge.value) navigateTo('/')
  await loadCategories()
})

const eventId = computed(() => authState.value?.eventId || '')

// Load assigned categories
const allCategories = ref<any[]>([])
const assignedCategories = computed(() => allCategories.value)

async function loadCategories() {
  if (!eventId.value) return
  allCategories.value = (await $fetch(`/api/events/${eventId.value}/categories`)) as any[]
}

// Category state polling
const selectedCategoryId = ref<string | null>(null)
const catState = ref<any>(null)
const myVotes = ref<Record<string, number>>({})
const myChoreoVotes = ref<Record<string, { themeId: string; score: number }[]>>({})

const stateUrl = computed(() =>
  selectedCategoryId.value
    ? `/api/events/${eventId.value}/categories/${selectedCategoryId.value}/state`
    : ''
)

const { data: polledState, stop: stopPolling, start: startPolling } = usePolling(stateUrl, {
  immediate: false,
})

watch(polledState, (val) => {
  if (val) catState.value = val
})

async function selectCategory(catId: string) {
  selectedCategoryId.value = catId
  catState.value = null
  judgeSelectedParticipantId.value = null
  myVotes.value = {}
  myChoreoVotes.value = {}
  battleVote.value = null
  battleVoteSubmitted.value = false
  currentBattleMatchup.value = null
  startPolling()
  await loadMyVotes()
}

watch(selectedCategoryId, (val) => {
  if (!val) {
    stopPolling()
    loadCategories()
  }
})

async function loadMyVotes() {
  if (!selectedCategoryId.value || !eventId.value) return
  try {
    const resp = await $fetch<any>(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/votes/my`)
    if (resp.type === 'preselection') {
      myVotes.value = resp.votes
    } else {
      myChoreoVotes.value = resp.votes
    }
  } catch {
    // Not critical
  }
}

// Current participant helpers
const currentIndex = computed(() => {
  if (!catState.value?.participants || !catState.value?.currentParticipantId) return 0
  return catState.value.participants.findIndex((p: any) => p.id === catState.value.currentParticipantId)
})

const currentParticipantName = computed(() => {
  if (!catState.value?.participants || currentIndex.value < 0) return '—'
  return catState.value.participants[currentIndex.value]?.name || '—'
})

// Judge's own participant selection (independent from host)
const judgeSelectedParticipantId = ref<string | null>(null)

const judgeSelectedIndex = computed(() => {
  if (!catState.value?.participants || !judgeSelectedParticipantId.value) return 0
  return catState.value.participants.findIndex((p: any) => p.id === judgeSelectedParticipantId.value)
})

const judgeSelectedName = computed(() => {
  if (!catState.value?.participants || judgeSelectedIndex.value < 0) return '—'
  return catState.value.participants[judgeSelectedIndex.value]?.name || '—'
})

const hostCurrentIndex = computed(() => {
  if (!catState.value?.participants || !catState.value?.currentParticipantId) return 0
  return catState.value.participants.findIndex((p: any) => p.id === catState.value.currentParticipantId)
})

const hostCurrentName = computed(() => {
  if (!catState.value?.participants || hostCurrentIndex.value < 0) return '—'
  return catState.value.participants[hostCurrentIndex.value]?.name || '—'
})

// Initialize judge selection to first participant when entering preselection
watch(() => catState.value?.phase, (phase) => {
  if (phase === 'preselection' && catState.value?.participants?.length && !judgeSelectedParticipantId.value) {
    judgeSelectedParticipantId.value = catState.value.participants[0]?.id
  }
})

// Preselection score
const currentScore = ref<number | null>(null)
const themeScores = reactive<Record<string, number>>({})

// When judge-selected participant changes, load existing vote
watch(judgeSelectedParticipantId, (pid) => {
  if (!pid) return
  if (catState.value?.type !== 'choreo' || catState.value?.themes?.length === 0) {
    // Preselection
    currentScore.value = myVotes.value[pid] ?? null
  } else {
    // Choreo
    const existing = myChoreoVotes.value[pid] || []
    for (const theme of catState.value?.themes || []) {
      const vote = existing.find((v: any) => v.themeId === theme.id)
      themeScores[theme.id] = vote ? vote.score : 5
    }
  }
})

const hasChoreoVote = computed(() => {
  const pid = judgeSelectedParticipantId.value
  if (!pid) return false
  return !!(myChoreoVotes.value[pid] && myChoreoVotes.value[pid].length > 0)
})

function getMyScoreForParticipant(participantId: string): string | null {
  if (catState.value?.type === 'choreo' && catState.value?.themes?.length > 0) {
    const votes = myChoreoVotes.value[participantId]
    if (!votes || votes.length === 0) return null
    const avg = votes.reduce((sum: number, v: any) => sum + v.score, 0) / votes.length
    return avg.toFixed(1)
  } else {
    const score = myVotes.value[participantId]
    return score !== undefined ? score.toFixed(1) : null
  }
}

// Submit votes
const submitting = ref(false)

function advanceToNext() {
  const participants = catState.value?.participants
  if (!participants || judgeSelectedIndex.value >= participants.length - 1) return
  judgeSelectedParticipantId.value = participants[judgeSelectedIndex.value + 1]?.id
}

async function submitPreselectionVote() {
  if (currentScore.value === null || !judgeSelectedParticipantId.value) return
  submitting.value = true
  try {
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/votes/preselection`, {
      method: 'POST',
      body: {
        participantId: judgeSelectedParticipantId.value,
        score: currentScore.value,
      },
    })
    myVotes.value[judgeSelectedParticipantId.value] = currentScore.value
    // Auto-advance to next participant
    advanceToNext()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to submit vote')
  } finally {
    submitting.value = false
  }
}

async function submitChoreoVote() {
  if (!judgeSelectedParticipantId.value) return
  submitting.value = true
  try {
    const scores = (catState.value.themes || []).map((t: any) => ({
      themeId: t.id,
      score: themeScores[t.id] ?? 5,
    }))
    await $fetch(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/votes/choreo`, {
      method: 'POST',
      body: {
        participantId: judgeSelectedParticipantId.value,
        scores,
      },
    })
    myChoreoVotes.value[judgeSelectedParticipantId.value] = scores
    // Auto-advance to next participant
    advanceToNext()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to submit vote')
  } finally {
    submitting.value = false
  }
}

// Battle voting
const battleVote = ref<string | null>(null)
const battleVoteSubmitted = ref(false)
const battleVoteResult = ref<{ autoResolved?: boolean; tied?: boolean; winnerId?: string; allVoted?: boolean; totalVoted?: number; totalAssigned?: number } | null>(null)
const currentBattleMatchup = ref<any>(null)

// Load current matchup during battles phase
watch(() => catState.value?.currentMatchupId, async (matchupId) => {
  battleVote.value = null
  battleVoteSubmitted.value = false
  battleVoteResult.value = null
  if (!matchupId || !selectedCategoryId.value) {
    currentBattleMatchup.value = null
    return
  }
  try {
    const bracket = await $fetch<any>(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/bracket`)
    const matchup = bracket.all?.find((m: any) => m.id === matchupId)
    currentBattleMatchup.value = matchup || null
    // Check if judge already voted on this matchup
    if (matchup) {
      const existing = matchup.battleVotes?.find((v: any) => v.judgeId === authState.value?.judgeId)
      if (existing) {
        battleVote.value = existing.isTie ? 'tie' : existing.votedParticipantId
        battleVoteSubmitted.value = true
      }
    }
  } catch {
    currentBattleMatchup.value = null
  }
}, { immediate: true })

async function submitBattleVote() {
  if (!battleVote.value || !currentBattleMatchup.value) return
  submitting.value = true
  try {
    const body = battleVote.value === 'tie'
      ? { isTie: true }
      : { votedParticipantId: battleVote.value }
    const result = await $fetch<any>(`/api/events/${eventId.value}/categories/${selectedCategoryId.value}/matchups/${currentBattleMatchup.value.id}/vote`, {
      method: 'POST',
      body,
    })
    battleVoteSubmitted.value = true
    battleVoteResult.value = result
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to submit vote')
  } finally {
    submitting.value = false
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

function formatPhase(phase: string | undefined): string {
  if (!phase || phase === 'idle') return 'not started'
  return phase
}
</script>

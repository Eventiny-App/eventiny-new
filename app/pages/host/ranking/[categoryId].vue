<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="goBack" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Ranking</h1>
      <UBadge v-if="ranking" variant="outline">{{ ranking.phase }}</UBadge>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <UCard v-if="loading">
        <div class="text-center py-6 text-gray-400">Loading ranking…</div>
      </UCard>

      <template v-if="ranking">
        <!-- Tie warning -->
        <div v-if="ranking.tieAtCutoff" class="bg-yellow-900/20 border border-yellow-700 rounded p-3">
          <p class="text-sm text-yellow-400 font-medium">⚠ Tie at bracket cutoff</p>
          <p class="text-xs text-yellow-300/80">
            There is a tie at position {{ ranking.bracketSize }} — the last spot to qualify for battles.
            The host or organizer should resolve this tie (e.g., by running a tie-breaker round).
          </p>
        </div>

        <!-- Bracket size info -->
        <p v-if="ranking.bracketSize" class="text-sm text-gray-400">
          Top <strong>{{ ranking.bracketSize }}</strong> will advance to battles.
          The green line below shows the cutoff.
        </p>

        <!-- Ranking table -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              {{ ranking.type === 'choreo' ? 'Choreographic Ranking' : 'Preselection Ranking' }}
            </h3>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-700">
                  <th class="text-left py-2 px-3">#</th>
                  <th class="text-left py-2 px-3">Participant</th>
                  <th class="text-right py-2 px-3">Average</th>
                  <th v-if="ranking.type === 'choreo'" v-for="theme in ranking.themes" :key="theme.id" class="text-right py-2 px-3 text-xs">
                    {{ theme.name }}
                  </th>
                  <th v-for="judge in (ranking.ranking[0]?.judgeScores || [])" :key="judge.judgeId" class="text-right py-2 px-3 text-xs">
                    {{ judge.judgeName }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(r, i) in ranking.ranking" :key="r.participantId">
                  <!-- Bracket cutoff line -->
                  <tr v-if="ranking.bracketSize && i === ranking.bracketSize">
                    <td :colspan="columnCount" class="py-0">
                      <div class="border-t-2 border-green-500 my-1"></div>
                    </td>
                  </tr>
                  <tr class="border-b border-gray-800 hover:bg-gray-900/50" :class="{ 'opacity-50': ranking.bracketSize && i >= ranking.bracketSize }">
                    <td class="py-2 px-3 font-medium">{{ r.rank }}</td>
                    <td class="py-2 px-3">{{ r.participantName }}</td>
                    <td class="py-2 px-3 text-right font-bold text-green-400">{{ r.averageScore.toFixed(2) }}</td>
                    <td v-if="ranking.type === 'choreo'" v-for="theme in ranking.themes" :key="theme.id" class="py-2 px-3 text-right text-xs">
                      {{ getThemeScore(r, theme.id) }}
                    </td>
                    <td v-for="js in r.judgeScores" :key="js.judgeId" class="py-2 px-3 text-right text-xs">
                      {{ js.score !== null && js.score !== undefined ? (typeof js.score === 'number' ? js.score.toFixed(1) : js.averageScore?.toFixed(1) || '—') : '—' }}
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </UCard>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const categoryId = route.params.categoryId as string

const { user, fetchMe, isHost, isOrganizer, isAdmin } = useAuth()
const authState = useAuth().state

const eventId = computed(() => {
  // Host gets eventId from auth state, organizer gets from user or route query
  if (authState.value?.eventId) return authState.value.eventId
  if (user.value?.eventId) return user.value.eventId
  return (route.query.eventId as string) || ''
})

const ranking = ref<any>(null)
const loading = ref(true)

async function loadRanking() {
  if (!eventId.value) return
  loading.value = true
  try {
    ranking.value = await $fetch(`/api/events/${eventId.value}/categories/${categoryId}/ranking`)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchMe()
  await loadRanking()
})

const columnCount = computed(() => {
  let cols = 3 // rank, name, average
  if (ranking.value?.type === 'choreo') cols += (ranking.value.themes?.length || 0)
  cols += (ranking.value?.ranking?.[0]?.judgeScores?.length || 0)
  return cols
})

function getThemeScore(r: any, themeId: string) {
  const ts = r.themeScores?.find((t: any) => t.themeId === themeId)
  return ts ? ts.average.toFixed(2) : '—'
}

function goBack() {
  if (isHost.value) {
    navigateTo(`/host?category=${categoryId}`)
  } else {
    navigateTo(`/organizer/events/${eventId.value}`)
  }
}
</script>

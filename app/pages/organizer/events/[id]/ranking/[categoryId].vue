<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo(`/organizer/events/${eventId}`)" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Ranking — {{ ranking?.type === 'choreo' ? 'Choreographic' : 'Preselection' }}</h1>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <UCard v-if="loading">
        <div class="text-center py-6 text-gray-400">Loading ranking…</div>
      </UCard>

      <template v-if="ranking">
        <div v-if="ranking.tieAtCutoff" class="bg-yellow-900/20 border border-yellow-700 rounded p-3">
          <p class="text-sm text-yellow-400 font-medium">⚠ Tie at bracket cutoff</p>
          <p class="text-xs text-yellow-300/80">
            There is a tie at position {{ ranking.bracketSize }}.
            Consider running a tie-breaker.
          </p>
        </div>

        <p v-if="ranking.bracketSize" class="text-sm text-gray-400">
          Top <strong>{{ ranking.bracketSize }}</strong> advance to versus rounds.
        </p>

        <UCard>
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
                  <tr v-if="ranking.bracketSize && i === ranking.bracketSize">
                    <td :colspan="100" class="py-0">
                      <div class="border-t-2 border-green-500 my-1"></div>
                    </td>
                  </tr>
                  <tr class="border-b border-gray-800 hover:bg-gray-900/50" :class="{ 'opacity-50': ranking.bracketSize && i >= ranking.bracketSize }">
                    <td class="py-2 px-3 font-medium">{{ r.rank }}</td>
                    <td class="py-2 px-3">{{ r.participantName }}</td>
                    <td class="py-2 px-3 text-right font-bold text-green-400">{{ r.averageScore.toFixed(2) }}</td>
                    <td v-if="ranking.type === 'choreo'" v-for="theme in ranking.themes" :key="theme.id" class="py-2 px-3 text-right text-xs">
                      {{ r.themeScores?.find((t: any) => t.themeId === theme.id)?.average?.toFixed(2) || '—' }}
                    </td>
                    <td v-for="js in r.judgeScores" :key="js.judgeId" class="py-2 px-3 text-right text-xs">
                      {{ js.score !== null && js.score !== undefined ? (js.score?.toFixed ? js.score.toFixed(1) : js.averageScore?.toFixed(1)) : '—' }}
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
const eventId = route.params.id as string
const categoryId = route.params.categoryId as string

const ranking = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    ranking.value = await $fetch(`/api/events/${eventId}/categories/${categoryId}/ranking`)
  } finally {
    loading.value = false
  }
})
</script>

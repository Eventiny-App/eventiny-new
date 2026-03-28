<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo(`/organizer/events/${eventId}`)" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Categories</h1>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400">
          Categories define the different competitions in your event. Each category can be a
          <strong>Versus</strong> (elimination bracket) or <strong>Choreographic</strong> (scored performance by crews/soloists).
        </p>
        <UButton icon="i-lucide-plus" @click="openCreate" class="cursor-pointer shrink-0 ml-4">
          New Category
        </UButton>
      </div>

      <!-- Category list -->
      <UCard v-if="categories.length === 0 && !loading">
        <div class="text-center py-6">
          <p class="text-gray-400">No categories yet. Create your first one!</p>
        </div>
      </UCard>

      <div v-else class="space-y-3">
        <UCard v-for="cat in categories" :key="cat.id">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-lg">{{ cat.name }}</span>
                <span class="text-xs text-gray-500 uppercase tracking-wide">{{ cat.type === 'battle' ? 'Versus' : 'Choreographic' }}</span>
                <UBadge v-if="cat.categoryState?.phase && cat.categoryState.phase !== 'idle'" :color="phaseColor(cat.categoryState.phase)" variant="outline">
                  {{ cat.categoryState.phase }}
                </UBadge>
              </div>

              <!-- Battle details -->
              <div v-if="cat.type === 'battle'" class="text-sm text-gray-400 mt-1 space-x-3">
                <span>Top {{ cat.bracketSize }}</span>
                <span>Voting: {{ cat.battleVotingMode === 'app' ? 'App (judges vote individually)' : 'Hands (host marks winner)' }}</span>
              </div>

              <!-- Choreo details -->
              <div v-if="cat.type === 'choreo'" class="text-sm text-gray-400 mt-1">
                <span v-if="cat.choreoThemes?.length">Themes: {{ cat.choreoThemes.map((t: any) => t.name).join(', ') }}</span>
                <span v-if="cat.choreoBattleTop" class="ml-3">→ Versus top {{ cat.choreoBattleTop }}</span>
              </div>

              <div class="text-xs text-gray-500 mt-1">
                {{ cat._count.participantCategories }} participants · {{ cat._count.judgeCategories }} judges
              </div>
            </div>

            <div class="flex gap-1 shrink-0">
              <UButton v-if="cat.categoryState?.phase && cat.categoryState.phase !== 'idle'" icon="i-lucide-bar-chart-2" variant="ghost" size="sm" class="cursor-pointer" @click="navigateTo(`/organizer/events/${eventId}/ranking/${cat.id}`)" />
              <UButton icon="i-lucide-pencil" variant="ghost" size="sm" class="cursor-pointer" @click="openEdit(cat)" />
              <UButton icon="i-lucide-trash-2" variant="ghost" size="sm" color="error" class="cursor-pointer" @click="deleteCategory(cat)" />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <UModal v-model:open="showModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">{{ editing ? 'Edit Category' : 'New Category' }}</h3>
            <p class="text-sm text-gray-400 mt-1">
              {{ editing
                ? 'Modify the category settings. Note: changing the type is not allowed after creation.'
                : 'Choose the type of competition and configure its settings.'
              }}
            </p>
          </template>

          <div class="space-y-5">
            <UFormField label="Category Name" help="A descriptive name, e.g. 'Breaking Top 16', 'Hip Hop Crew Choreo'.">
              <UInput v-model="form.name" placeholder="Category name" class="w-full" />
            </UFormField>

            <UFormField v-if="!editing" label="Type" help="Versus = elimination bracket after preselections. Choreographic = crews/soloists scored on multiple themes.">
              <USelect v-model="form.type" :items="typeOptions" class="w-full" />
            </UFormField>

            <!-- Versus settings -->
            <template v-if="form.type === 'battle'">
              <UFormField label="Bracket Size" help="How many dancers advance from preselections to the versus bracket. If more participants register, the rest are eliminated in preselections.">
                <USelect v-model="form.bracketSize" :items="bracketSizeOptions" class="w-full" />
              </UFormField>

              <UFormField label="Versus Voting Mode" help="Hands = judges raise hands, host marks the winner manually. App = each judge selects the winner on their device, the app computes the result (supports weighted votes).">
                <USelect v-model="form.battleVotingMode" :items="votingModeOptions" class="w-full" />
              </UFormField>
            </template>

            <!-- Choreo settings -->
            <template v-if="form.type === 'choreo'">
              <UFormField label="Voting Themes" help="Judges will give a score (0–10) for each theme per participant. You can add, remove, or reorder themes.">
                <div class="space-y-2">
                  <div v-for="(theme, i) in form.choreoThemes" :key="i" class="flex gap-2">
                    <UInput v-model="form.choreoThemes[i]" placeholder="Theme name" class="flex-1" />
                    <UButton icon="i-lucide-x" variant="ghost" size="sm" color="error" class="cursor-pointer" @click="form.choreoThemes.splice(i, 1)" />
                  </div>
                  <UButton icon="i-lucide-plus" variant="ghost" size="sm" class="cursor-pointer" @click="form.choreoThemes.push('')">
                    Add theme
                  </UButton>
                </div>
              </UFormField>

              <UFormField label="Versus Phase (optional)" help="After scoring, optionally have the top N crews compete in an elimination bracket. Leave empty for ranking-only.">
                <UInput v-model.number="form.choreoBattleTop" type="number" placeholder="e.g. 4" class="w-full" />
              </UFormField>
            </template>

            <div class="flex gap-2 justify-end pt-2">
              <UButton variant="ghost" @click="showModal = false" class="cursor-pointer">Cancel</UButton>
              <UButton :loading="saving" @click="handleSave" class="cursor-pointer">
                {{ editing ? 'Save Changes' : 'Create Category' }}
              </UButton>
            </div>
          </div>

          <p v-if="formError" class="text-red-400 text-sm mt-2">{{ formError }}</p>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const eventId = route.params.id as string

const categories = ref<any[]>([])
const loading = ref(true)

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await $fetch(`/api/events/${eventId}/categories`)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadCategories())

// Form state
const showModal = ref(false)
const editing = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')

const form = reactive({
  name: '',
  type: 'battle' as 'battle' | 'choreo',
  bracketSize: 16,
  battleVotingMode: 'hands' as 'hands' | 'app',
  choreoThemes: ['Originality', 'Technique', 'Style'] as string[],
  choreoBattleTop: null as number | null,
})

const typeOptions = [
  { label: 'Versus (elimination bracket)', value: 'battle' },
  { label: 'Choreographic (scored themes)', value: 'choreo' },
]

const bracketSizeOptions = [
  { label: 'Top 4', value: 4 },
  { label: 'Top 8', value: 8 },
  { label: 'Top 16', value: 16 },
  { label: 'Top 32', value: 32 },
  { label: 'Top 64', value: 64 },
]

const votingModeOptions = [
  { label: 'Hands — judges raise hands, host marks winner', value: 'hands' },
  { label: 'App — judges vote individually on device', value: 'app' },
]

function openCreate() {
  editing.value = false
  editingId.value = ''
  form.name = ''
  form.type = 'battle'
  form.bracketSize = 16
  form.battleVotingMode = 'hands'
  form.choreoThemes = ['Originality', 'Technique', 'Style']
  form.choreoBattleTop = null
  formError.value = ''
  showModal.value = true
}

function openEdit(cat: any) {
  editing.value = true
  editingId.value = cat.id
  form.name = cat.name
  form.type = cat.type
  form.bracketSize = cat.bracketSize ?? 16
  form.battleVotingMode = cat.battleVotingMode
  form.choreoThemes = cat.choreoThemes?.map((t: any) => t.name) || []
  form.choreoBattleTop = cat.choreoBattleTop
  formError.value = ''
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      await $fetch(`/api/events/${eventId}/categories/${editingId.value}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          bracketSize: form.type === 'battle' ? form.bracketSize : undefined,
          battleVotingMode: form.battleVotingMode,
          choreoBattleTop: form.type === 'choreo' ? form.choreoBattleTop : undefined,
          choreoThemes: form.type === 'choreo'
            ? form.choreoThemes.filter(Boolean).map((name) => ({ name }))
            : undefined,
        },
      })
    } else {
      await $fetch(`/api/events/${eventId}/categories`, {
        method: 'POST',
        body: {
          name: form.name,
          type: form.type,
          bracketSize: form.type === 'battle' ? form.bracketSize : null,
          battleVotingMode: form.battleVotingMode,
          choreoBattleTop: form.type === 'choreo' ? form.choreoBattleTop : null,
          choreoThemes: form.type === 'choreo'
            ? form.choreoThemes.filter(Boolean)
            : undefined,
        },
      })
    }
    showModal.value = false
    await loadCategories()
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function deleteCategory(cat: any) {
  if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return
  try {
    await $fetch(`/api/events/${eventId}/categories/${cat.id}`, { method: 'DELETE' })
    await loadCategories()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete')
  }
}

function phaseColor(phase?: string) {
  const map: Record<string, string> = {
    idle: 'neutral', preselection: 'warning', ranking: 'info',
    playoffs: 'primary', battles: 'error', completed: 'success',
  }
  return (map[phase || 'idle'] || 'neutral') as any
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo(`/organizer/events/${eventId}`)" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Judges</h1>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400 max-w-xl">
          Judges score participants during preselections and vote on battle winners.
          Each judge gets a <strong>PIN</strong> to log in from their device.
          Assign judges to the categories they will judge, and optionally set a
          <strong>weight</strong> (only used in "App" voting mode — a higher weight means more influence on the result).
        </p>
        <UButton icon="i-lucide-plus" @click="openCreate" class="cursor-pointer shrink-0 ml-4">
          New Judge
        </UButton>
      </div>

      <UCard v-if="judges.length === 0 && !loading">
        <div class="text-center py-6">
          <p class="text-gray-400">No judges yet. Add judges and assign them to categories.</p>
        </div>
      </UCard>

      <div v-else class="space-y-3">
        <UCard v-for="judge in judges" :key="judge.id">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ judge.name }}</span>
                <UBadge variant="outline" class="font-mono">PIN: {{ judge.accessPin }}</UBadge>
              </div>
              <div v-if="judge.judgeCategories.length" class="flex flex-wrap gap-1 mt-2">
                <UBadge v-for="jc in judge.judgeCategories" :key="jc.category.id" variant="subtle" :color="jc.category.type === 'battle' ? 'error' : 'info'">
                  {{ jc.category.name }}
                  <span v-if="jc.weight !== 1" class="ml-1 opacity-60">(×{{ jc.weight }})</span>
                </UBadge>
              </div>
              <p v-else class="text-xs text-gray-500 mt-1">Not assigned to any category yet</p>
            </div>
            <div class="flex gap-1 shrink-0">
              <UButton icon="i-lucide-pencil" variant="ghost" size="sm" class="cursor-pointer" @click="openEdit(judge)" />
              <UButton icon="i-lucide-trash-2" variant="ghost" size="sm" color="error" class="cursor-pointer" @click="deleteJudge(judge)" />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <UModal v-model:open="showModal">
      <template #content>
        <div class="flex flex-col max-h-[85dvh]">
          <div class="px-6 pt-6 pb-3 shrink-0">
            <h3 class="text-lg font-semibold">{{ isEditing ? 'Edit Judge' : 'New Judge' }}</h3>
          </div>

          <div class="overflow-y-auto px-6 flex-1">
            <div class="space-y-4 pb-2">
              <UFormField label="Judge Name" help="Displayed on the judge's screen to confirm identity and avoid tablet mix-ups.">
                <UInput v-model="form.name" placeholder="Judge name" class="w-full" />
              </UFormField>

              <UFormField label="Access PIN" help="The judge enters this PIN to access the event from their device. Must be unique within the event (different from other judges and hosts).">
                <UInput v-model="form.accessPin" placeholder="e.g. 1234" class="w-full" />
              </UFormField>

              <UFormField label="Assigned Categories" help="Select which categories this judge will score. A judge only sees categories they are assigned to.">
                <div class="space-y-2">
                  <div v-for="cat in categories" :key="cat.id" class="flex items-center gap-3">
                    <UCheckbox
                      :model-value="form.selectedCategoryIds.includes(cat.id)"
                      @update:model-value="(v: boolean) => toggleCategory(cat.id, v)"
                    />
                    <span class="text-sm">{{ cat.name }}</span>
                    <UBadge :color="cat.type === 'battle' ? 'error' : 'info'" variant="subtle" size="xs">{{ cat.type }}</UBadge>

                    <!-- Weight input (only if category uses app voting) -->
                    <template v-if="form.selectedCategoryIds.includes(cat.id) && cat.battleVotingMode === 'app'">
                      <UInput
                        v-model.number="form.weights[cat.id]"
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        class="w-20"
                        placeholder="1.0"
                      />
                      <span class="text-xs text-gray-500">weight</span>
                    </template>
                  </div>
                  <p v-if="categories.length === 0" class="text-xs text-gray-500">No categories created yet. Create categories first.</p>
                </div>
              </UFormField>

              <p v-if="formError" class="text-red-400 text-sm">{{ formError }}</p>
            </div>
          </div>

          <div class="flex gap-2 justify-end px-6 py-4 border-t border-gray-800 shrink-0">
            <UButton variant="ghost" @click="showModal = false" class="cursor-pointer">Cancel</UButton>
            <UButton :loading="saving" @click="handleSave" class="cursor-pointer">
              {{ isEditing ? 'Save Changes' : 'Create Judge' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const eventId = route.params.id as string

const judges = ref<any[]>([])
const categories = ref<any[]>([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    const [j, c] = await Promise.all([
      $fetch(`/api/events/${eventId}/judges`),
      $fetch(`/api/events/${eventId}/categories`),
    ])
    judges.value = j as any[]
    categories.value = c as any[]
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())

// Form
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')

const form = reactive({
  name: '',
  accessPin: '',
  selectedCategoryIds: [] as string[],
  weights: {} as Record<string, number>,
})

function openCreate() {
  isEditing.value = false
  editingId.value = ''
  form.name = ''
  form.accessPin = ''
  form.selectedCategoryIds = []
  form.weights = {}
  formError.value = ''
  showModal.value = true
}

function toggleCategory(catId: string, checked: boolean) {
  if (checked) {
    form.selectedCategoryIds.push(catId)
  } else {
    form.selectedCategoryIds = form.selectedCategoryIds.filter(id => id !== catId)
  }
}

function openEdit(judge: any) {
  isEditing.value = true
  editingId.value = judge.id
  form.name = judge.name
  form.accessPin = judge.accessPin
  form.selectedCategoryIds = judge.judgeCategories.map((jc: any) => jc.category.id)
  form.weights = {}
  for (const jc of judge.judgeCategories) {
    form.weights[jc.category.id] = jc.weight
  }
  formError.value = ''
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  formError.value = ''
  try {
    const body = {
      name: form.name,
      accessPin: form.accessPin,
      categoryIds: form.selectedCategoryIds,
      weights: form.weights,
    }
    if (isEditing.value) {
      await $fetch(`/api/events/${eventId}/judges/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/events/${eventId}/judges`, { method: 'POST', body })
    }
    showModal.value = false
    await loadData()
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function deleteJudge(judge: any) {
  if (!confirm(`Delete judge "${judge.name}"? This will also remove all their votes.`)) return
  try {
    await $fetch(`/api/events/${eventId}/judges/${judge.id}`, { method: 'DELETE' })
    await loadData()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete')
  }
}
</script>

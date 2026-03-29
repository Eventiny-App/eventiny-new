<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo(`/organizer/events/${eventId}`)" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Participants</h1>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex-1 min-w-[200px]">
          <UInput v-model="searchQuery" placeholder="Search by name…" icon="i-lucide-search" class="w-full" />
          <p class="text-xs text-gray-500 mt-1">{{ filteredParticipants.length }} participant{{ filteredParticipants.length === 1 ? '' : 's' }} found</p>
        </div>
        <UButton icon="i-lucide-plus" @click="openCreate" class="cursor-pointer shrink-0">
          Register Participant
        </UButton>
      </div>

      <UCard v-if="filteredParticipants.length === 0 && !loading">
        <div class="text-center py-6">
          <p class="text-gray-400">{{ searchQuery ? 'No participants match your search.' : 'No participants registered yet.' }}</p>
        </div>
      </UCard>

      <div v-else class="space-y-3">
        <UCard v-for="p in filteredParticipants" :key="p.id">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium">{{ p.name }}</span>
              <div v-if="p.participantCategories.length" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="pc in p.participantCategories"
                  :key="pc.category.id"
                  variant="subtle"
                  :color="pc.withdrawn ? 'neutral' : (pc.category.type === 'battle' ? 'error' : 'info')"
                  :class="{ 'line-through opacity-50': pc.withdrawn }"
                >
                  {{ pc.category.name }}
                  <span v-if="pc.withdrawn" class="ml-1">(withdrawn)</span>
                </UBadge>
              </div>
              <p v-else class="text-xs text-gray-500 mt-1">Not registered in any category</p>
            </div>
            <div class="flex gap-1 shrink-0">
              <UButton icon="i-lucide-pencil" variant="ghost" size="sm" class="cursor-pointer" @click="openEdit(p)" />
              <UButton icon="i-lucide-trash-2" variant="ghost" size="sm" color="error" class="cursor-pointer" @click="deleteParticipant(p)" />
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
            <h3 class="text-lg font-semibold">{{ isEditing ? 'Edit Participant' : 'Register Participant' }}</h3>
          </div>

          <div class="overflow-y-auto px-6 flex-1">
            <div class="space-y-4 pb-2">
              <UFormField label="Participant Name" help="The dancer's name or crew name as it will appear in rankings and brackets.">
                <UInput v-model="form.name" placeholder="Name" class="w-full" />
              </UFormField>

              <UFormField label="Categories" help="Select which categories this participant competes in. If a category has already started, they will be appended at the end of the order.">
                <div class="space-y-2">
                  <div v-for="cat in categories" :key="cat.id" class="flex items-center gap-3">
                    <UCheckbox
                      :model-value="form.selectedCategoryIds.includes(cat.id)"
                      @update:model-value="(v: boolean) => toggleCategory(cat.id, v)"
                    />
                    <span class="text-sm">{{ cat.name }}</span>
                    <UBadge :color="cat.type === 'battle' ? 'error' : 'info'" variant="subtle" size="xs">{{ cat.type }}</UBadge>
                    <UBadge v-if="getPhase(cat.id) !== 'idle'" variant="outline" size="xs">{{ getPhase(cat.id) }}</UBadge>
                  </div>
                  <p v-if="categories.length === 0" class="text-xs text-gray-500">No categories created yet.</p>
                </div>
              </UFormField>

              <div v-if="isEditing && withdrawWarnings.length" class="bg-yellow-900/20 border border-yellow-700 rounded p-3">
                <p class="text-sm text-yellow-400 font-medium mb-1">⚠ Active category removal</p>
                <p class="text-xs text-yellow-300/80">
                  The following categories have already started. Unchecking them will mark the participant as
                  <strong>withdrawn</strong> (soft-removed), not fully deleted, so existing scores are preserved:
                </p>
                <ul class="text-xs text-yellow-300/80 mt-1 list-disc list-inside">
                  <li v-for="w in withdrawWarnings" :key="w">{{ w }}</li>
                </ul>
              </div>

              <p v-if="formError" class="text-red-400 text-sm">{{ formError }}</p>
            </div>
          </div>

          <div class="flex gap-2 justify-end px-6 py-4 border-t border-gray-800 shrink-0">
            <UButton variant="ghost" @click="showModal = false" class="cursor-pointer">Cancel</UButton>
            <UButton :loading="saving" @click="handleSave" class="cursor-pointer">
              {{ isEditing ? 'Save Changes' : 'Register' }}
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

const participants = ref<any[]>([])
const categories = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')

const filteredParticipants = computed(() => {
  if (!searchQuery.value.trim()) return participants.value
  const q = searchQuery.value.toLowerCase()
  return participants.value.filter((p: any) => p.name.toLowerCase().includes(q))
})

async function loadData() {
  loading.value = true
  try {
    const [p, c] = await Promise.all([
      $fetch(`/api/events/${eventId}/participants`),
      $fetch(`/api/events/${eventId}/categories`),
    ])
    participants.value = p as any[]
    categories.value = c as any[]
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())

function getPhase(categoryId: string): string {
  const cat = categories.value.find((c: any) => c.id === categoryId)
  return cat?.categoryState?.phase || 'idle'
}

// Form
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')
const editingOriginalCatIds = ref<string[]>([])

const form = reactive({
  name: '',
  selectedCategoryIds: [] as string[],
})

const withdrawWarnings = computed(() => {
  if (!isEditing.value) return []
  const removed = editingOriginalCatIds.value.filter(id => !form.selectedCategoryIds.includes(id))
  return removed
    .filter(id => getPhase(id) !== 'idle')
    .map(id => {
      const cat = categories.value.find((c: any) => c.id === id)
      return cat ? `${cat.name} (${getPhase(id)})` : id
    })
})

function openCreate() {
  isEditing.value = false
  editingId.value = ''
  form.name = ''
  form.selectedCategoryIds = []
  editingOriginalCatIds.value = []
  formError.value = ''
  showModal.value = true
}

function toggleCategory(catId: string, checked: boolean) {
  if (checked) {
    if (!form.selectedCategoryIds.includes(catId)) {
      form.selectedCategoryIds.push(catId)
    }
  } else {
    form.selectedCategoryIds = form.selectedCategoryIds.filter(id => id !== catId)
  }
}

function openEdit(p: any) {
  isEditing.value = true
  editingId.value = p.id
  form.name = p.name
  const activeIds = p.participantCategories
    .filter((pc: any) => !pc.withdrawn)
    .map((pc: any) => pc.category.id)
  form.selectedCategoryIds = [...activeIds]
  editingOriginalCatIds.value = [...activeIds]
  formError.value = ''
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  formError.value = ''
  try {
    if (isEditing.value) {
      const addCategoryIds = form.selectedCategoryIds.filter(id => !editingOriginalCatIds.value.includes(id))
      const removeCategoryIds = editingOriginalCatIds.value.filter(id => !form.selectedCategoryIds.includes(id))
      await $fetch(`/api/events/${eventId}/participants/${editingId.value}`, {
        method: 'PATCH',
        body: { name: form.name, addCategoryIds, removeCategoryIds },
      })
    } else {
      await $fetch(`/api/events/${eventId}/participants`, {
        method: 'POST',
        body: { name: form.name, categoryIds: form.selectedCategoryIds },
      })
    }
    showModal.value = false
    await loadData()
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function deleteParticipant(p: any) {
  if (!confirm(`Delete participant "${p.name}"? This cannot be undone.`)) return
  try {
    await $fetch(`/api/events/${eventId}/participants/${p.id}`, { method: 'DELETE' })
    await loadData()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete')
  }
}
</script>

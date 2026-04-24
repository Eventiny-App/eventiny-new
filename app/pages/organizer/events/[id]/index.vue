<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo('/organizer')" class="cursor-pointer" />
        <h1 class="text-xl font-bold">{{ eventData?.name || 'Loading...' }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton variant="ghost" icon="i-lucide-pencil" size="sm" @click="showEditEvent = true" class="cursor-pointer">
          Edit
        </UButton>
        <UButton variant="ghost" color="error" icon="i-lucide-trash-2" size="sm" @click="showDeleteConfirm = true" class="cursor-pointer">
          Delete
        </UButton>
        <UButton variant="ghost" icon="i-lucide-log-out" @click="logout" class="cursor-pointer" />
      </div>
    </nav>

    <div v-if="eventData" class="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      <!-- Event Info Card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Event Details</h2>
            <p class="text-sm text-gray-400">ID: <code class="bg-gray-800 px-2 py-0.5 rounded text-xs">{{ eventData.id }}</code></p>
          </div>
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold">{{ eventData._count.categories }}</p>
            <p class="text-xs text-gray-400">Categories</p>
          </div>
          <div>
            <p class="text-2xl font-bold">{{ eventData._count.participants }}</p>
            <p class="text-xs text-gray-400">Participants</p>
          </div>
          <div>
            <p class="text-2xl font-bold">{{ eventData._count.judges }}</p>
            <p class="text-xs text-gray-400">Judges</p>
          </div>
          <div>
            <p class="text-2xl font-bold">{{ eventData._count.hosts }}</p>
            <p class="text-xs text-gray-400">Hosts</p>
          </div>
        </div>
        <template #footer>
          <p class="text-sm text-gray-400">
            {{ formatDate(eventData.startDate) }} – {{ formatDate(eventData.endDate) }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            Share the Event ID above with judges and hosts so they can log in with their PIN.
          </p>
        </template>
      </UCard>

      <!-- Quick Actions -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <UButton block variant="soft" icon="i-lucide-layers" @click="navigateTo(`/organizer/events/${eventId}/categories`)" class="cursor-pointer">
          Categories
        </UButton>
        <UButton block variant="soft" icon="i-lucide-users" @click="navigateTo(`/organizer/events/${eventId}/participants`)" class="cursor-pointer">
          Participants
        </UButton>
        <UButton block variant="soft" icon="i-lucide-scale" @click="navigateTo(`/organizer/events/${eventId}/judges`)" class="cursor-pointer">
          Judges
        </UButton>
        <UButton block variant="soft" icon="i-lucide-mic" @click="navigateTo(`/organizer/events/${eventId}/hosts`)" class="cursor-pointer">
          Hosts
        </UButton>
        <UButton block variant="soft" color="success" icon="i-lucide-file-text" @click="exportModalOpen = true" class="cursor-pointer">
          Export PDF
        </UButton>
      </div>

      <!-- How it works -->
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">How it works</h3>
        </template>
        <ol class="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li><strong>Create categories</strong> — Set up battle or choreographic categories with the desired format.</li>
          <li><strong>Add judges and hosts</strong> — Create accounts with PINs. Assign them to the relevant categories.</li>
          <li><strong>Register participants</strong> — Add dancers/crews and assign them to their categories.</li>
          <li><strong>Start the event</strong> — The host opens a category, and judges begin voting on their devices.</li>
          <li><strong>Run preselections → battles</strong> — The app handles ranking, tie detection, and bracket generation.</li>
        </ol>
      </UCard>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-red-400">Delete Event</h3>
          </template>
          <p class="text-sm text-gray-300">
            This will permanently remove all categories, participants, judges, hosts, votes, and brackets associated with <strong>{{ eventData?.name }}</strong>.
          </p>
          <p class="text-sm text-red-400 mt-2">This action cannot be undone.</p>
          <UFormField class="mt-4">
            <template #label>
              <span class="text-sm text-gray-300">Type <strong>{{ eventData?.name }}</strong> to confirm</span>
            </template>
            <UInput v-model="deleteConfirmName" placeholder="Event name" class="w-full" />
          </UFormField>
          <div class="flex gap-2 justify-end mt-4">
            <UButton variant="ghost" @click="showDeleteConfirm = false" class="cursor-pointer">Cancel</UButton>
            <UButton color="error" :loading="deleting" :disabled="!deleteNameMatches" @click="handleDeleteEvent" class="cursor-pointer">Delete Event</UButton>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Export PDF Modal -->
    <UModal v-model:open="exportModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Export PDF</h3>
          </template>

          <div class="space-y-5">
            <!-- Category selection -->
            <div>
              <p class="text-sm font-medium text-gray-300 mb-2">Categories to include</p>
              <div class="space-y-2">
                <label
                  v-for="cat in exportCategories"
                  :key="cat.id"
                  class="flex items-start gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="cat.id"
                    v-model="selectedCategoryIds"
                    class="mt-0.5 accent-blue-500"
                  />
                  <div>
                    <span class="text-sm text-white">{{ cat.name }}</span>
                    <span class="text-xs text-gray-400 ml-2">({{ cat.type }} · {{ cat.categoryState?.phase || 'idle' }})</span>
                    <p v-if="(cat.categoryState?.phase || 'idle') === 'idle' && selectedCategoryIds.includes(cat.id)" class="text-xs text-amber-400 mt-0.5">
                      ⚠ Preselection will be started for this category to generate participant numbers.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Content toggle -->
            <div>
              <p class="text-sm font-medium text-gray-300 mb-2">Content</p>
              <div class="space-y-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="exportContent" value="votes" class="accent-blue-500" />
                  <span class="text-sm text-white">Participant list + votes <span class="text-gray-400">(scores may be blank)</span></span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="exportContent" value="list" class="accent-blue-500" />
                  <span class="text-sm text-white">Participant list only</span>
                </label>
              </div>
            </div>

            <!-- Choreo detail (only when votes mode + selected choreo-with-themes category exists) -->
            <div v-if="exportContent === 'votes' && hasSelectedChoreoWithThemes">
              <p class="text-sm font-medium text-gray-300 mb-2">Choreo score detail</p>
              <div class="space-y-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="choreoDetail" value="averaged" class="accent-blue-500" />
                  <span class="text-sm text-white">Averaged scores per criteria</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="choreoDetail" value="full" class="accent-blue-500" />
                  <span class="text-sm text-white">Full detail — one table per judge</span>
                </label>
              </div>
            </div>
          </div>

          <div class="flex gap-2 justify-end mt-6">
            <UButton variant="ghost" @click="exportModalOpen = false" class="cursor-pointer">Cancel</UButton>
            <UButton
              color="success"
              icon="i-lucide-file-text"
              :loading="exporting"
              :disabled="selectedCategoryIds.length === 0"
              @click="exportResults"
              class="cursor-pointer"
            >Export</UButton>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Edit Event Modal -->
    <UModal v-model:open="showEditEvent">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Edit Event</h3>
          </template>
          <UForm :state="editForm" class="space-y-4" @submit="handleEditEvent">
            <UFormField label="Event Name" name="name">
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField label="Start Date" name="startDate">
              <UInput v-model="editForm.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="End Date" name="endDate">
              <UInput v-model="editForm.endDate" type="date" class="w-full" />
            </UFormField>
            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showEditEvent = false" class="cursor-pointer">Cancel</UButton>
              <UButton type="submit" :loading="saving" class="cursor-pointer">Save</UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const eventId = route.params.id as string
const { logout, fetchMe, isOrganizer, isAdmin } = useAuth()

const eventData = ref<any>(null)

async function loadEvent() {
  eventData.value = await $fetch(`/api/events/${eventId}`)
}

onMounted(async () => {
  await fetchMe()
  if (!isOrganizer.value && !isAdmin.value) navigateTo('/')
  await loadEvent()
})

// Delete
const showDeleteConfirm = ref(false)
const deleteConfirmName = ref('')
const deleting = ref(false)
const deleteNameMatches = computed(() => deleteConfirmName.value === eventData.value?.name)

watch(showDeleteConfirm, (v) => {
  if (!v) deleteConfirmName.value = ''
})

async function handleDeleteEvent() {
  deleting.value = true
  try {
    await $fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    navigateTo('/organizer')
  } finally {
    deleting.value = false
  }
}

// Edit
const showEditEvent = ref(false)
const saving = ref(false)
const editForm = reactive({ name: '', startDate: '', endDate: '' })

watch(showEditEvent, (v) => {
  if (v && eventData.value) {
    editForm.name = eventData.value.name
    editForm.startDate = new Date(eventData.value.startDate).toISOString().slice(0, 10)
    editForm.endDate = new Date(eventData.value.endDate).toISOString().slice(0, 10)
  }
})

async function handleEditEvent() {
  saving.value = true
  try {
    await $fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        startDate: new Date(editForm.startDate).toISOString(),
        endDate: new Date(editForm.endDate).toISOString(),
      },
    })
    showEditEvent.value = false
    await loadEvent()
  } finally {
    saving.value = false
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Export
const exportModalOpen = ref(false)
const exporting = ref(false)
const exportCategories = ref<any[]>([])
const selectedCategoryIds = ref<string[]>([])
const exportContent = ref<'votes' | 'list'>('votes')
const choreoDetail = ref<'averaged' | 'full'>('averaged')

const hasSelectedChoreoWithThemes = computed(() =>
  exportCategories.value.some(
    cat => selectedCategoryIds.value.includes(cat.id) && cat.type === 'choreo' && cat.choreoThemes?.length > 0,
  ),
)

async function loadExportCategories() {
  exportCategories.value = await $fetch(`/api/events/${eventId}/categories`)
  selectedCategoryIds.value = exportCategories.value.map((c: any) => c.id)
}

watch(exportModalOpen, (v) => {
  if (v) loadExportCategories()
})

async function exportResults() {
  exporting.value = true
  try {
    // Start preselection for any IDLE categories in the selection
    for (const catId of selectedCategoryIds.value) {
      const cat = exportCategories.value.find((c: any) => c.id === catId)
      if (cat && (cat.categoryState?.phase || 'idle') === 'idle') {
        try {
          await $fetch(`/api/events/${eventId}/categories/${catId}/state`, {
            method: 'POST',
            body: { action: 'start-preselection' },
          })
        } catch {
          // skip this category if it has no participants or already started
        }
      }
    }

    const params = new URLSearchParams({
      categories: selectedCategoryIds.value.join(','),
      content: exportContent.value,
      choreoDetail: choreoDetail.value,
    })
    const data = await $fetch(`/api/events/${eventId}/export?${params}`)
    const { generatePdf } = await import('~/utils/generatePdf')
    generatePdf(data as any, { content: exportContent.value, choreoDetail: choreoDetail.value })
    exportModalOpen.value = false
  } finally {
    exporting.value = false
  }
}
</script>

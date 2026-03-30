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
        <UButton block variant="soft" color="success" icon="i-lucide-download" :loading="exporting" @click="exportResults" class="cursor-pointer">
          Export
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

onMounted(async () => {
  await fetchMe()
  if (!isOrganizer.value && !isAdmin.value) navigateTo('/')
})

const eventData = ref<any>(null)

async function loadEvent() {
  eventData.value = await $fetch(`/api/events/${eventId}`)
}

onMounted(() => loadEvent())

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
const exporting = ref(false)

async function exportResults() {
  exporting.value = true
  try {
    const csv = await $fetch<string>(`/api/events/${eventId}/export`, { responseType: 'text' })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventData.value?.name || 'event'}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">Eventiny</h1>
        <UBadge color="info" variant="subtle">Organizer</UBadge>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-400">{{ authState.user?.name }}</span>
        <UButton variant="ghost" icon="i-lucide-log-out" @click="logout" class="cursor-pointer">
          Log out
        </UButton>
      </div>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Your Events</h2>
          <p class="text-sm text-gray-400 mt-1">
            Create and manage your dance events. Each event can have multiple categories,
            judges, hosts, and participants.
          </p>
        </div>
        <UButton icon="i-lucide-plus" @click="showCreate = true" class="cursor-pointer">
          New Event
        </UButton>
      </div>

      <!-- Events list -->
      <UCard v-if="events.length === 0 && !loading">
        <div class="text-center py-8 space-y-2">
          <UIcon name="i-lucide-calendar-plus" class="text-4xl text-gray-600" />
          <p class="text-gray-400">You don't have any events yet.</p>
          <p class="text-sm text-gray-500">Click "New Event" to create your first dance event.</p>
        </div>
      </UCard>

      <div v-else class="space-y-3">
        <UCard
          v-for="ev in events"
          :key="ev.id"
          class="cursor-pointer hover:bg-gray-900 transition-colors"
          @click="navigateTo(`/organizer/events/${ev.id}`)"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-lg">{{ ev.name }}</span>
              </div>
              <p class="text-sm text-gray-400 mt-1">
                {{ formatDate(ev.startDate) }} – {{ formatDate(ev.endDate) }}
              </p>
              <div class="flex gap-4 text-xs text-gray-500 mt-2">
                <span>{{ ev._count.categories }} categories</span>
                <span>{{ ev._count.participants }} participants</span>
                <span>{{ ev._count.judges }} judges</span>
                <span>{{ ev._count.hosts }} hosts</span>
              </div>
            </div>
            <UIcon name="i-lucide-chevron-right" class="text-gray-500" />
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create Event Modal -->
    <UModal v-model:open="showCreate">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Create New Event</h3>
            <p class="text-sm text-gray-400 mt-1">
              Set the basic info for your event. You can add categories, judges, and hosts after creation.
            </p>
          </template>
          <UForm :state="createForm" class="space-y-4" @submit="handleCreate">
            <UFormField label="Event Name" name="name" help="A short, descriptive name for the event (e.g., 'Street Battle Roma 2026').">
              <UInput v-model="createForm.name" placeholder="My Dance Event" class="w-full" />
            </UFormField>
            <UFormField label="Start Date" name="startDate" help="When the event begins (participants can register before this date).">
              <UInput v-model="createForm.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="End Date" name="endDate" help="When the event ends. Your access may expire a few days after this.">
              <UInput v-model="createForm.endDate" type="date" class="w-full" />
            </UFormField>
            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showCreate = false" class="cursor-pointer">Cancel</UButton>
              <UButton type="submit" :loading="saving" class="cursor-pointer">Create Event</UButton>
            </div>
          </UForm>
          <p v-if="createError" class="text-red-400 text-sm mt-2">{{ createError }}</p>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { logout, fetchMe, isOrganizer, isAdmin, state: authState } = useAuth()

onMounted(async () => {
  await fetchMe()
  if (!isOrganizer.value && !isAdmin.value) {
    navigateTo('/')
  }
})

const events = ref<any[]>([])
const loading = ref(true)

async function loadEvents() {
  loading.value = true
  try {
    events.value = await $fetch('/api/events')
  } finally {
    loading.value = false
  }
}

onMounted(() => loadEvents())

// Create
const showCreate = ref(false)
const saving = ref(false)
const createError = ref('')
const createForm = reactive({ name: '', startDate: '', endDate: '' })

async function handleCreate() {
  saving.value = true
  createError.value = ''
  try {
    const ev = await $fetch('/api/events', {
      method: 'POST',
      body: {
        name: createForm.name,
        startDate: new Date(createForm.startDate).toISOString(),
        endDate: new Date(createForm.endDate).toISOString(),
      },
    })
    showCreate.value = false
    Object.assign(createForm, { name: '', startDate: '', endDate: '' })
    navigateTo(`/organizer/events/${(ev as any).id}`)
  } catch (e: any) {
    createError.value = e?.data?.statusMessage || 'Failed to create event'
  } finally {
    saving.value = false
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">Eventiny</h1>
        <UBadge color="primary" variant="subtle">Admin</UBadge>
      </div>
      <UButton variant="ghost" icon="i-lucide-log-out" @click="logout" class="cursor-pointer">
        Log out
      </UButton>
    </nav>

    <div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      <!-- Organizers Section -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-2xl font-semibold">Organizers</h2>
            <p class="text-sm text-gray-400 mt-1">
              Manage event organizer accounts. Each organizer can create and manage their own events.
              Set an expiry date to automatically revoke access after the event is over.
            </p>
          </div>
          <UButton icon="i-lucide-plus" @click="showCreateOrganizer = true" class="cursor-pointer">
            New Organizer
          </UButton>
        </div>

        <UCard v-if="organizers.length === 0 && !loadingOrganizers">
          <p class="text-gray-400 text-center py-4">No organizers yet. Create one to get started.</p>
        </UCard>

        <div v-else class="space-y-3">
          <UCard v-for="org in organizers" :key="org.id">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ org.name }}</span>
                  <UBadge v-if="!org.enabled" color="error" variant="subtle">Disabled</UBadge>
                  <UBadge v-else-if="org.expiresAt && new Date(org.expiresAt) < new Date()" color="warning" variant="subtle">Expired</UBadge>
                  <UBadge v-else color="success" variant="subtle">Active</UBadge>
                </div>
                <p class="text-sm text-gray-400">{{ org.email }}</p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ org._count.events }} event(s)
                  <span v-if="org.expiresAt"> · Expires: {{ formatDate(org.expiresAt) }}</span>
                  <span v-else> · No expiry</span>
                </p>
              </div>
              <div class="flex gap-2">
                <UButton
                  :icon="org.enabled ? 'i-lucide-ban' : 'i-lucide-check'"
                  :color="org.enabled ? 'warning' : 'success'"
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                  @click="toggleOrganizer(org)"
                >
                  {{ org.enabled ? 'Disable' : 'Enable' }}
                </UButton>
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                  @click="editOrganizer(org)"
                >
                  Edit
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Events Section -->
      <section>
        <div class="mb-4">
          <h2 class="text-2xl font-semibold">All Events</h2>
          <p class="text-sm text-gray-400 mt-1">
            Overview of all events across all organizers. You can access any event for support.
          </p>
        </div>

        <UCard v-if="events.length === 0 && !loadingEvents">
          <p class="text-gray-400 text-center py-4">No events created yet.</p>
        </UCard>

        <div v-else class="space-y-3">
          <UCard v-for="ev in events" :key="ev.id" class="cursor-pointer hover:bg-gray-900 transition-colors" @click="navigateTo(`/organizer/events/${ev.id}`)">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ ev.name }}</span>
                </div>
                <p class="text-sm text-gray-400">
                  By {{ ev.organizer.name }} · {{ formatDate(ev.startDate) }} – {{ formatDate(ev.endDate) }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ ev._count.categories }} categories · {{ ev._count.participants }} participants
                </p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="text-gray-500" />
            </div>
          </UCard>
        </div>
      </section>
    </div>

    <!-- Create Organizer Modal -->
    <UModal v-model:open="showCreateOrganizer">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">New Organizer</h3>
            <p class="text-sm text-gray-400 mt-1">
              Create an account for an event organizer. They will log in with the email and password you set.
            </p>
          </template>
          <UForm :state="createForm" class="space-y-4" @submit="handleCreateOrganizer">
            <UFormField label="Full Name" name="name" help="The organizer's display name.">
              <UInput v-model="createForm.name" placeholder="John Doe" class="w-full" />
            </UFormField>
            <UFormField label="Email" name="email" help="Used for login. Must be unique.">
              <UInput v-model="createForm.email" type="email" placeholder="organizer@example.com" class="w-full" />
            </UFormField>
            <UFormField label="Password" name="password" help="At least 6 characters. Share this securely with the organizer.">
              <UInput v-model="createForm.password" type="password" placeholder="Minimum 6 characters" class="w-full" />
            </UFormField>
            <UFormField label="Access Expiry (optional)" name="expiresAt" help="After this date, the organizer can no longer log in. Leave empty for no expiry.">
              <UInput v-model="createForm.expiresAt" type="date" class="w-full" />
            </UFormField>
            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showCreateOrganizer = false" class="cursor-pointer">Cancel</UButton>
              <UButton type="submit" :loading="saving" class="cursor-pointer">Create</UButton>
            </div>
          </UForm>
          <p v-if="createError" class="text-red-400 text-sm mt-2">{{ createError }}</p>
        </UCard>
      </template>
    </UModal>

    <!-- Edit Organizer Modal -->
    <UModal v-model:open="showEditOrganizer">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Edit Organizer</h3>
          </template>
          <UForm :state="editForm" class="space-y-4" @submit="handleEditOrganizer">
            <UFormField label="Full Name" name="name">
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField label="New Password (optional)" name="password" help="Leave empty to keep the current password.">
              <UInput v-model="editForm.password" type="password" placeholder="Min 6 characters" class="w-full" />
            </UFormField>
            <UFormField label="Access Expiry" name="expiresAt" help="Change or remove the access expiry date.">
              <UInput v-model="editForm.expiresAt" type="date" class="w-full" />
            </UFormField>
            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showEditOrganizer = false" class="cursor-pointer">Cancel</UButton>
              <UButton type="submit" :loading="saving" class="cursor-pointer">Save</UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { logout, fetchMe, isAdmin } = useAuth()

// Guard: only superadmin
onMounted(async () => {
  await fetchMe()
  if (!isAdmin.value) {
    navigateTo('/')
  }
})

// --- Organizers ---
const organizers = ref<any[]>([])
const loadingOrganizers = ref(true)

async function loadOrganizers() {
  loadingOrganizers.value = true
  try {
    organizers.value = await $fetch('/api/admin/organizers')
  } finally {
    loadingOrganizers.value = false
  }
}

// Create
const showCreateOrganizer = ref(false)
const createForm = reactive({ name: '', email: '', password: '', expiresAt: '' })
const createError = ref('')
const saving = ref(false)

async function handleCreateOrganizer() {
  saving.value = true
  createError.value = ''
  try {
    await $fetch('/api/admin/organizers', {
      method: 'POST',
      body: {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        expiresAt: createForm.expiresAt ? new Date(createForm.expiresAt).toISOString() : null,
      },
    })
    showCreateOrganizer.value = false
    Object.assign(createForm, { name: '', email: '', password: '', expiresAt: '' })
    await loadOrganizers()
  } catch (e: any) {
    createError.value = e?.data?.statusMessage || 'Failed to create organizer'
  } finally {
    saving.value = false
  }
}

// Edit
const showEditOrganizer = ref(false)
const editForm = reactive({ id: '', name: '', expiresAt: '', password: '' })

function editOrganizer(org: any) {
  editForm.id = org.id
  editForm.name = org.name
  editForm.password = ''
  editForm.expiresAt = org.expiresAt ? new Date(org.expiresAt).toISOString().slice(0, 10) : ''
  showEditOrganizer.value = true
}

async function handleEditOrganizer() {
  saving.value = true
  try {
    await $fetch(`/api/admin/organizers/${editForm.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
        ...(editForm.password ? { password: editForm.password } : {}),
      },
    })
    showEditOrganizer.value = false
    await loadOrganizers()
  } finally {
    saving.value = false
  }
}

// Toggle enable/disable
async function toggleOrganizer(org: any) {
  await $fetch(`/api/admin/organizers/${org.id}`, {
    method: 'PATCH',
    body: { enabled: !org.enabled },
  })
  await loadOrganizers()
}

// --- Events ---
const events = ref<any[]>([])
const loadingEvents = ref(true)

async function loadEvents() {
  loadingEvents.value = true
  try {
    events.value = await $fetch('/api/admin/events')
  } finally {
    loadingEvents.value = false
  }
}

// Load data
onMounted(async () => {
  await Promise.all([loadOrganizers(), loadEvents()])
})

// Helpers
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

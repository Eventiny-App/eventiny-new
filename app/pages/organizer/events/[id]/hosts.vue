<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="navigateTo(`/organizer/events/${eventId}`)" class="cursor-pointer" />
      <h1 class="text-xl font-bold">Hosts</h1>
    </nav>

    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400 max-w-xl">
          Hosts (MCs) control the event flow from their device — they advance through
          participants, move to the next round, and trigger battle matchups.
          Each host gets a <strong>PIN</strong> to log in. A host can manage any category in the event.
        </p>
        <UButton icon="i-lucide-plus" @click="openCreate" class="cursor-pointer shrink-0 ml-4">
          New Host
        </UButton>
      </div>

      <UCard v-if="hosts.length === 0 && !loading">
        <div class="text-center py-6">
          <p class="text-gray-400">No hosts yet. Add hosts to control the event flow.</p>
        </div>
      </UCard>

      <div v-else class="space-y-3">
        <UCard v-for="host in hosts" :key="host.id">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ host.name }}</span>
                <UBadge variant="outline" class="font-mono">PIN: {{ host.accessPin }}</UBadge>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <UButton icon="i-lucide-pencil" variant="ghost" size="sm" class="cursor-pointer" @click="openEdit(host)" />
              <UButton icon="i-lucide-trash-2" variant="ghost" size="sm" color="error" class="cursor-pointer" @click="deleteHost(host)" />
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
            <h3 class="text-lg font-semibold">{{ isEditing ? 'Edit Host' : 'New Host' }}</h3>
          </template>

          <div class="space-y-4">
            <UFormField label="Host Name" help="Displayed to confirm who is controlling the event from this device.">
              <UInput v-model="form.name" placeholder="Host name" class="w-full" />
            </UFormField>

            <UFormField label="Access PIN" help="The host enters this PIN to access the event. Must be unique within the event (different from other hosts and judges).">
              <UInput v-model="form.accessPin" placeholder="e.g. 5678" class="w-full" />
            </UFormField>

            <div class="flex gap-2 justify-end">
              <UButton variant="ghost" @click="showModal = false" class="cursor-pointer">Cancel</UButton>
              <UButton :loading="saving" @click="handleSave" class="cursor-pointer">
                {{ isEditing ? 'Save Changes' : 'Create Host' }}
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

const hosts = ref<any[]>([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    hosts.value = (await $fetch(`/api/events/${eventId}/hosts`)) as any[]
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
})

function openCreate() {
  isEditing.value = false
  editingId.value = ''
  form.name = ''
  form.accessPin = ''
  formError.value = ''
  showModal.value = true
}

function openEdit(host: any) {
  isEditing.value = true
  editingId.value = host.id
  form.name = host.name
  form.accessPin = host.accessPin
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
    }
    if (isEditing.value) {
      await $fetch(`/api/events/${eventId}/hosts/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/events/${eventId}/hosts`, { method: 'POST', body })
    }
    showModal.value = false
    await loadData()
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function deleteHost(host: any) {
  if (!confirm(`Delete host "${host.name}"?`)) return
  try {
    await $fetch(`/api/events/${eventId}/hosts/${host.id}`, { method: 'DELETE' })
    await loadData()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete')
  }
}
</script>

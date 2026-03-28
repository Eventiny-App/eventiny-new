<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-950 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white">Eventiny</h1>
        <p class="text-gray-400 mt-2">Dance Battle Event Manager</p>
      </div>

      <UCard>
        <template #header>
          <UTabs v-model="activeTab" :items="tabs" class="w-full" />
        </template>

        <!-- Admin / Organizer Login -->
        <div v-if="activeTab === 'login'">
          <p class="text-sm text-gray-400 mb-4">
            Log in as the platform administrator or as an event organizer. Both use email and password.
          </p>
          <UForm :state="loginForm" :validate="validateLogin" class="space-y-4" @submit="handleLogin">
            <UFormField label="Email" name="email" help="The email address provided by the administrator.">
              <UInput v-model="loginForm.email" type="email" placeholder="organizer@example.com" icon="i-lucide-mail" class="w-full" />
            </UFormField>
            <UFormField label="Password" name="password">
              <UInput v-model="loginForm.password" type="password" placeholder="Your password" icon="i-lucide-lock" class="w-full" />
            </UFormField>
            <UButton type="submit" block :loading="loading" class="cursor-pointer">
              Log in
            </UButton>
          </UForm>
          <p v-if="loginError" class="text-red-400 text-sm mt-3">{{ loginError }}</p>
        </div>

        <!-- Judge / Host PIN Access -->
        <div v-else>
          <p class="text-sm text-gray-400 mb-4">
            Judges and hosts access the event using a PIN provided by the organizer. Select your role and enter the PIN.
          </p>
          <UForm :state="pinForm" class="space-y-4" @submit="handlePinLogin">
            <UFormField label="Event Code" name="eventId" help="The event identifier shared by the organizer.">
              <UInput v-model="pinForm.eventId" placeholder="Event ID" icon="i-lucide-calendar" class="w-full" />
            </UFormField>
            <UFormField label="Your Role" name="role" help="Select whether you are a judge or a host for this event.">
              <USelect v-model="pinForm.role" :items="roleOptions" class="w-full" />
            </UFormField>
            <UFormField label="Access PIN" name="pin" help="The personal PIN assigned to you by the organizer.">
              <UInput v-model="pinForm.pin" type="password" placeholder="Your PIN" icon="i-lucide-key-round" class="w-full" />
            </UFormField>
            <UButton type="submit" block :loading="loading" class="cursor-pointer">
              Enter Event
            </UButton>
          </UForm>
          <p v-if="loginError" class="text-red-400 text-sm mt-3">{{ loginError }}</p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { login, loginWithPin, fetchMe, isLoggedIn, state: authState } = useAuth()

// Redirect if already logged in
onMounted(async () => {
  await fetchMe()
  if (isLoggedIn.value) {
    redirectByRole()
  }
})

const activeTab = ref('login')
const tabs = [
  { label: 'Admin / Organizer', value: 'login' },
  { label: 'Judge / Host', value: 'pin' },
]

const loading = ref(false)
const loginError = ref('')

// --- Admin/Organizer form ---
const loginForm = reactive({ email: '', password: '' })

function validateLogin(state: typeof loginForm) {
  const errors = []
  if (!state.email) errors.push({ name: 'email', message: 'Email is required' })
  if (!state.password) errors.push({ name: 'password', message: 'Password is required' })
  return errors
}

async function handleLogin() {
  loading.value = true
  loginError.value = ''
  try {
    await login(loginForm.email, loginForm.password)
    redirectByRole()
  } catch (e: any) {
    loginError.value = e?.data?.statusMessage || e?.statusMessage || 'Login failed'
  } finally {
    loading.value = false
  }
}

// --- Judge/Host PIN form ---
const pinForm = reactive({ eventId: '', pin: '', role: 'judge' as 'judge' | 'host' })
const roleOptions = [
  { label: 'Judge', value: 'judge' },
  { label: 'Host', value: 'host' },
]

async function handlePinLogin() {
  loading.value = true
  loginError.value = ''
  try {
    await loginWithPin(pinForm.eventId, pinForm.pin, pinForm.role)
    redirectByRole()
  } catch (e: any) {
    loginError.value = e?.data?.statusMessage || e?.statusMessage || 'Login failed'
  } finally {
    loading.value = false
  }
}

function redirectByRole() {
  const role = authState.value.role
  if (role === 'superadmin') navigateTo('/admin')
  else if (role === 'organizer') navigateTo('/organizer')
  else if (role === 'judge') navigateTo('/judge')
  else if (role === 'host') navigateTo('/host')
}
</script>

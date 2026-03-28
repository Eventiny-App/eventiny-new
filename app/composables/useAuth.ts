interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  expiresAt?: string | null
}

interface AuthState {
  user: AuthUser | null
  role: string | null
  token: string | null
  judgeId?: string | null
  hostId?: string | null
  eventId?: string | null
}

export function useAuth() {
  const state = useState<AuthState>('auth', () => ({
    user: null,
    role: null,
    token: null,
    judgeId: null,
    hostId: null,
    eventId: null,
  }))

  const isLoggedIn = computed(() => !!state.value.role)
  const isAdmin = computed(() => state.value.role === 'superadmin')
  const isOrganizer = computed(() => state.value.role === 'organizer')
  const isJudge = computed(() => state.value.role === 'judge')
  const isHost = computed(() => state.value.role === 'host')

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    state.value = {
      user: data.user,
      role: data.user.role,
      token: data.token,
    }
    return data
  }

  async function loginWithPin(eventId: string, pin: string, role: 'judge' | 'host') {
    const data = await $fetch('/api/auth/pin', {
      method: 'POST',
      body: { eventId, pin, role },
    })
    if (role === 'judge' && 'judge' in data) {
      state.value = {
        user: null,
        role: 'judge',
        token: data.token,
        judgeId: data.judge.id,
        eventId: data.judge.eventId,
      }
    } else if (role === 'host' && 'host' in data) {
      state.value = {
        user: null,
        role: 'host',
        token: data.token,
        hostId: data.host.id,
        eventId: data.host.eventId,
      }
    }
    return data
  }

  async function fetchMe() {
    try {
      const data = await $fetch('/api/auth/me')
      if ('user' in data && data.user) {
        state.value = {
          user: data.user as AuthUser,
          role: data.role,
          token: state.value.token,
        }
      } else if ('judge' in data && data.judge) {
        state.value = {
          user: null,
          role: 'judge',
          token: state.value.token,
          judgeId: data.judge.id,
          eventId: data.eventId,
        }
      } else if ('host' in data && data.host) {
        state.value = {
          user: null,
          role: 'host',
          token: state.value.token,
          hostId: data.host.id,
          eventId: data.eventId,
        }
      }
    } catch {
      state.value = { user: null, role: null, token: null }
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    state.value = { user: null, role: null, token: null }
    navigateTo('/')
  }

  return {
    state,
    isLoggedIn,
    isAdmin,
    isOrganizer,
    isJudge,
    isHost,
    login,
    loginWithPin,
    fetchMe,
    logout,
  }
}

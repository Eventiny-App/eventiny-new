/**
 * usePolling — periodically fetches remote state and returns reactive data.
 *
 * Usage:
 *   const { data, loading, error, refresh } = usePolling('/api/some/endpoint')
 *
 * The default interval comes from runtimeConfig.public.pollingInterval.
 * Automatically starts on mount and stops on unmount.
 */
export function usePolling<T>(url: string | Ref<string>, opts: { interval?: number; immediate?: boolean } = {}) {
  const config = useRuntimeConfig()
  const interval = opts.interval ?? (config.public.pollingInterval as number) ?? 2500
  const immediate = opts.immediate ?? true

  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const resolvedUrl = typeof url === 'string' ? url : url.value
      data.value = await $fetch<T>(resolvedUrl)
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || 'Fetch failed'
    } finally {
      loading.value = false
    }
  }

  function start() {
    stop()
    if (immediate) refresh()
    timer = setInterval(refresh, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { data, loading, error, refresh, start, stop }
}

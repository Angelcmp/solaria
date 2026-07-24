export async function appLog(level: string, message: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('app_log', { level, message })
  } catch {
    // Fallback: if backend logging fails, at least log to console
    console.error('[appLog failed]', level, message)
  }
}

export function setupGlobalErrorLogging() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    const msg = `window.error: ${event.message} at ${event.filename}:${event.lineno}`
    appLog('error', msg)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
    appLog('error', `unhandledrejection: ${reason}`)
  })
}

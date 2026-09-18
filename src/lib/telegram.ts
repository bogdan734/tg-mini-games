import WebApp from '@twa-dev/sdk'

/** True when running inside the Telegram client (initData is non-empty). */
export const isTelegram = Boolean(WebApp.initData)

/** Compare "7.10" >= "6.9" style versions (the SDK's own helper is not exported). */
export function versionAtLeast(min: string): boolean {
  const cur = String(WebApp.version ?? '6.0').split('.').map(Number)
  const req = min.split('.').map(Number)
  for (let i = 0; i < Math.max(cur.length, req.length); i++) {
    const a = cur[i] ?? 0, b = req[i] ?? 0
    if (a !== b) return a > b
  }
  return true
}

export function initTelegram(): void {
  try {
    WebApp.ready()
    WebApp.expand()
    if (versionAtLeast('7.7')) WebApp.disableVerticalSwipes()
    if (versionAtLeast('6.1')) WebApp.setHeaderColor('secondary_bg_color')
  } catch {
    /* outside Telegram: nothing to do */
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'): void {
  try {
    if (!versionAtLeast('6.1')) return
    if (kind === 'success' || kind === 'error') WebApp.HapticFeedback.notificationOccurred(kind)
    else WebApp.HapticFeedback.impactOccurred(kind)
  } catch {
    /* ignore */
  }
}

export function showBackButton(onClick: () => void): () => void {
  if (!versionAtLeast('6.1')) return () => {}
  WebApp.BackButton.onClick(onClick)
  WebApp.BackButton.show()
  return () => {
    WebApp.BackButton.offClick(onClick)
    WebApp.BackButton.hide()
  }
}

export function userName(): string {
  return WebApp.initDataUnsafe?.user?.first_name ?? 'игрок'
}

export { WebApp }

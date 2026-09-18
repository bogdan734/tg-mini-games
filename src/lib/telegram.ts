import WebApp from '@twa-dev/sdk'

/** True when running inside the Telegram client (initData is non-empty). */
export const isTelegram = Boolean(WebApp.initData)

export function initTelegram(): void {
  try {
    WebApp.ready()
    WebApp.expand()
    if (WebApp.isVersionAtLeast('7.7')) WebApp.disableVerticalSwipes()
    if (WebApp.isVersionAtLeast('6.1')) WebApp.setHeaderColor('secondary_bg_color')
  } catch {
    /* outside Telegram: nothing to do */
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'): void {
  try {
    if (!WebApp.isVersionAtLeast('6.1')) return
    if (kind === 'success' || kind === 'error') WebApp.HapticFeedback.notificationOccurred(kind)
    else WebApp.HapticFeedback.impactOccurred(kind)
  } catch {
    /* ignore */
  }
}

export function showBackButton(onClick: () => void): () => void {
  if (!WebApp.isVersionAtLeast('6.1')) return () => {}
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

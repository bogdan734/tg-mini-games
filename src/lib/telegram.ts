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

export const BOT_USERNAME = 'ADS_gamesBoT'

/** Bot API 8.0 methods that the SDK typings may not know about yet. */
type Modern = {
  requestFullscreen?: () => void
  lockOrientation?: () => void
  isFullscreen?: boolean
}

export function initTelegram(): void {
  try {
    WebApp.ready()
    WebApp.expand()
    if (versionAtLeast('7.7')) WebApp.disableVerticalSwipes()
    if (versionAtLeast('6.1')) WebApp.setHeaderColor('secondary_bg_color')
    if (isTelegram && versionAtLeast('8.0')) {
      const m = WebApp as unknown as Modern
      m.requestFullscreen?.()
      m.lockOrientation?.()
    }
  } catch {
    /* outside Telegram: nothing to do */
  }
}

/** Share a text with friends via Telegram's share sheet (falls back to Web Share / clipboard). */
export function shareText(text: string, url = `https://t.me/${BOT_USERNAME}`): void {
  if (isTelegram) {
    WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
    return
  }
  if (navigator.share) { void navigator.share({ text: `${text} ${url}` }).catch(() => {}); return }
  void navigator.clipboard?.writeText(`${text} ${url}`)
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

/** Open a Telegram Stars invoice; resolves with the final status ('paid' | 'cancelled' | 'failed' | 'pending'). */
export function openInvoice(link: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      WebApp.openInvoice(link, (status) => resolve(status))
    } catch {
      resolve('failed')
    }
  })
}

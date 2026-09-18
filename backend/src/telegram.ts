/** Minimal Telegram Bot API client for the Worker. */
export class BotApi {
  constructor(private token: string) {}

  async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
    if (!json.ok) throw new Error(`${method}: ${json.description ?? res.status}`)
    return json.result as T
  }

  sendMessage(chat_id: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra })
  }

  answerPreCheckoutQuery(id: string, ok: boolean, error_message?: string) {
    return this.call('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok, error_message })
  }

  /** Telegram Stars invoice link (currency XTR, no provider token). */
  createStarsInvoiceLink(title: string, description: string, payload: string, stars: number) {
    return this.call<string>('createInvoiceLink', {
      title, description, payload, currency: 'XTR', prices: [{ label: title, amount: stars }],
    })
  }
}

export interface Update {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string }
  }
  pre_checkout_query?: { id: string; from: { id: number }; currency: string; total_amount: number; invoice_payload: string }
}

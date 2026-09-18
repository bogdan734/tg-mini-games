/** Tiny synthesized sound effects (no audio files). Unlock on the first user gesture. */
export class Sfx {
  private ctx: AudioContext | null = null
  private lastShot = 0
  muted = false

  unlock(): void {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch { /* no audio */ }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx!
    const t0 = c.currentTime + delay
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g).connect(c.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  private noise(dur: number, vol: number, delay = 0): void {
    const c = this.ctx!
    const t0 = c.currentTime + delay
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(g).connect(c.destination)
    src.start(t0)
  }

  play(name: string): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return
    const now = performance.now()
    if (name.startsWith('shot:')) {
      if (now - this.lastShot < 70) return
      this.lastShot = now
      switch (name.slice(5)) {
        case 'volt': this.tone(900, 0.05, 'square', 0.05, 1400); break
        case 'frost': this.tone(700, 0.08, 'sine', 0.06, 350); break
        case 'blaze': this.tone(220, 0.12, 'sawtooth', 0.06, 90); this.noise(0.08, 0.04); break
        case 'venom': this.tone(320, 0.1, 'triangle', 0.06, 180); break
        case 'shadow': this.tone(130, 0.18, 'sawtooth', 0.08, 55); break
      }
      return
    }
    switch (name) {
      case 'kill': this.tone(420, 0.08, 'triangle', 0.07, 820); this.noise(0.05, 0.05); break
      case 'killHead': this.tone(220, 0.4, 'sawtooth', 0.16, 45); this.noise(0.35, 0.16); break
      case 'merge': [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'sine', 0.1, undefined, i * 0.07)); break
      case 'buy': this.tone(660, 0.06, 'sine', 0.08); this.tone(880, 0.08, 'sine', 0.08, undefined, 0.06); break
      case 'sell': this.tone(520, 0.15, 'sine', 0.08, 280); break
      case 'error': this.tone(150, 0.15, 'square', 0.06, 110); break
      case 'click': this.tone(1000, 0.03, 'sine', 0.05); break
      case 'wave': [330, 440, 550].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.09, undefined, i * 0.1)); break
      case 'pass': this.tone(110, 0.25, 'square', 0.1); this.tone(90, 0.25, 'square', 0.1, undefined, 0.25); break
      case 'evo': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.09, undefined, i * 0.08)); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, undefined, i * 0.15)); break
      case 'lose': [400, 300, 200, 120].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.08, undefined, i * 0.2)); break
      case 'dash': this.noise(0.2, 0.08); this.tone(200, 0.2, 'sawtooth', 0.05, 600); break
      case 'shield': this.tone(900, 0.15, 'sine', 0.08, 1400); break
    }
  }
}

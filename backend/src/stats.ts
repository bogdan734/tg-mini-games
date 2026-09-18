/** Per-run statistics reported by the client with a score. Clamped to sane ranges. */
export interface RunStats { killed: number; merges: number; evolutions: number; wave: number; won: boolean }

const clamp = (v: unknown, max: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.floor(n)) : 0
}

export function clampStats(input: Partial<Record<keyof RunStats, unknown>> | null | undefined): RunStats {
  return {
    killed: clamp(input?.killed, 600),
    merges: clamp(input?.merges, 60),
    evolutions: clamp(input?.evolutions, 20),
    wave: clamp(input?.wave, 60),
    won: input?.won === true,
  }
}

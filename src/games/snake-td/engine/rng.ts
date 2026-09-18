let rng: () => number = Math.random
export const setRng = (fn: () => number) => { rng = fn }
export const rand = () => rng()
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]

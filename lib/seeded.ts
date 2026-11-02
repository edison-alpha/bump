import { roundPrice } from "./format";

/** Deterministic PRNG (mulberry32) so sample data renders identically on server and client. */
export function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random-walk series of `length` points that ends exactly on `last`. */
export function makeSeries(seed: number, last: number, length = 40, volatility = 0.004, trend = 0) {
  const rand = seeded(seed);
  const raw: number[] = [1];
  for (let i = 1; i < length; i++) {
    raw.push(raw[i - 1] * (1 + (rand() - 0.5) * volatility * 2 + trend));
  }
  const scale = last / raw[length - 1];
  return raw.map((v) => roundPrice(v * scale));
}

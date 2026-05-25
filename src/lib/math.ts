export function normalizeRate(rate: unknown, name: string): number {
  if (typeof rate === "number") return rate;
  if (typeof rate === "string") return Number(rate);

  if (rate && typeof rate === "object" && "value" in rate) {
    return Number((rate as { value: unknown }).value);
  }

  throw new Error(`Invalid rate format: ${name}`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

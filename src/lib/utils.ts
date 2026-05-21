import { Decimal } from "decimal.js";


export function normalizeRate(rate: any, name: string): number {
  if (typeof rate === "number") return rate;
  if (typeof rate === "string") return Number(rate);

  if (rate && typeof rate === "object" && "value" in rate) {
    return Number(rate.value);
  }

  throw new Error(`Invalid rate format: ${name}`);
}

export function D(value: any) {
  if (value === null || value === undefined) return new Decimal(0);
  if (typeof value === "number" || typeof value === "string") {
    return new Decimal(value);
  }
  throw new Error("Invalid Decimal input: " + JSON.stringify(value));
}


export function validateRules(rules: any) {
  const cnss = rules?.cnss;

  if (!cnss) {
    throw new Error("CNSS missing in rules");
  }

  if (!Array.isArray(cnss.contributions)) {
    throw new Error("CNSS contributions must be an array");
  }

  for (const c of cnss.contributions) {
    if (typeof c.rate !== "number") {
      throw new Error("Invalid CNSS rate: " + JSON.stringify(c));
    }
  }
}
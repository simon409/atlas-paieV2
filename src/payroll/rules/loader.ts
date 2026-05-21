import fs from "fs";
import path from "path";
import type { PayrollRules } from "./types.ts";
import { validateRules } from "../../lib/utils.ts";

export function loadRules(year: number): PayrollRules {
  const filePath = path.join(
    process.cwd(),
    "src/payroll/rules",
    `${year}.json`
  );

  const raw = fs.readFileSync(filePath, "utf-8");
  const rules = JSON.parse(raw);
  validateRules(rules);
  return rules;
}
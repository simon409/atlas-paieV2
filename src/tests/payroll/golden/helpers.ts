import type { PayrollInput, PayrollResult } from "../../../types/payroll.types.ts";
import type { PayrollRules } from "../../../payroll/rules/types.ts";
import { calculatePayroll } from "../../../payroll/engine/grossToNet.ts";
import rules2026 from "../../../payroll/rules/2026.json";
import { assertApprox } from "../../utils/assert.ts";

type ExpectedPayroll = Partial<Omit<PayrollResult, "annualization" | "breakdown" | "trace">>;

export type GoldenCase = {
  input: PayrollInput;
  expected: ExpectedPayroll;
};

export function runGoldenCase(testCase: GoldenCase): PayrollResult {
  const result = calculatePayroll(testCase.input, rules2026 as PayrollRules);

  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    assertApprox(result[key as keyof ExpectedPayroll] as number, expectedValue, key);
  }

  return result;
}

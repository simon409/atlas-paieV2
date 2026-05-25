import salary6500 from "../fixtures/6500.json";
import { runGoldenCase } from "./helpers.ts";

test("golden payroll profile for mid salary", () => {
  const result = runGoldenCase(salary6500);

  expect(result.trace).toContain("IR: 145.10 (bracket 10%)");
});

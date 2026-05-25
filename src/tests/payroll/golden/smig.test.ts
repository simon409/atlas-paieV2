import salary4000 from "../fixtures/4000.json";
import { runGoldenCase } from "./helpers.ts";

test("golden payroll profile around SMIG range", () => {
  const result = runGoldenCase(salary4000);

  expect(result.irNet).toBe(0);
});

import salary20000 from "../fixtures/20000.json";
import { runGoldenCase } from "./helpers.ts";

test("golden payroll profile for high salary", () => {
  const result = runGoldenCase(salary20000);

  expect(result.fraisProfessionnels).toBe(2500);
});

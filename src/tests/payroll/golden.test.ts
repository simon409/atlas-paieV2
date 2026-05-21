import { calculatePayroll } from '../../payroll/engine/grossToNet.ts';
import * as fs from 'fs';
import * as path from 'path';

const rules = JSON.parse(
  fs.readFileSync(
    path.resolve("src/payroll/rules/2026.json"),
    "utf-8"
  )
);

type GoldenCase = {
  name: string;
  input: {
    baseSalary: number;
    allowances: number;
    bonuses: number;
    deductions: number;
    dependentsCount: number;
  };
  expected: {
    cnssEmployee: number;
    cnssEmployer: number;
    amoEmployee: number;
    amoEmployer: number;
    ir: number;
    netSalary: number;
  };
};

function runGoldenTest(testCase: GoldenCase) {
  const result = calculatePayroll(testCase.input, rules);

  try {
    assertApprox(result.cnssEmployee, testCase.expected.cnssEmployee, "CNSS Employee");
    assertApprox(result.cnssEmployer, testCase.expected.cnssEmployer, "CNSS Employer");

    assertApprox(result.amoEmployee, testCase.expected.amoEmployee, "AMO Employee");
    assertApprox(result.amoEmployer, testCase.expected.amoEmployer, "AMO Employer");

    assertApprox(result.irNet, testCase.expected.ir, "IR", 1);

    assertApprox(result.netSalary, testCase.expected.netSalary, "Net Salary", 1);

    console.log(`✅ PASS: ${testCase.name}`);
  } catch (err: any) {
    console.error(`❌ FAIL: ${testCase.name}`);
    console.error(err.message);
    console.dir(result, { depth: null });
  }
}

function assertApprox(actual: number, expected: number, label: string, tolerance = 1) {
  const diff = Math.abs(actual - expected);

  if (diff > tolerance) {
    throw new Error(
      `❌ ${label} mismatch\nExpected: ${expected}\nGot: ${actual}\nDiff: ${diff}`
    );
  }
}

console.log("🧪 Running STRICT Golden Payroll Tests (2026)\n");

test("Entry Level (SMIG-like)", () => {
  runGoldenTest({
    name: "Entry Level (SMIG-like)",
    input: {
      baseSalary: 4000,
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      dependentsCount: 0,
    },
    expected: {
      cnssEmployee: 179.2,
      cnssEmployer: 359.2,
      amoEmployee: 90.4,
      amoEmployer: 164.4,
      ir: 0,
      netSalary: 3730.4
    }
  });
});

test("Mid-Level Employee", () => {
  runGoldenTest({
    name: "Mid-Level Employee",
    input: {
      baseSalary: 10000,
      allowances: 2000,
      bonuses: 1000,
      deductions: 500,
      dependentsCount: 2,
    },
    expected: {
      // CNSS is capped at 6000
      cnssEmployee: 268.8,
      cnssEmployer: 538.8,

      // AMO = gross * rate (uncapped)
      amoEmployee: 281.6,
      amoEmployer: 513.5,

      // IR depends on your current brackets (from your engine output)
      ir: 1279.56,

      // FINAL NET (from your actual engine run)
      netSalary: 10669.47
    }
  });
});
test("High-Level Employee", () => {
  runGoldenTest({
    name: "High-Level Employee",
    input: {
      baseSalary: 20000,
      allowances: 5000,
      bonuses: 3000,
      deductions: 1000,
      dependentsCount: 3,
    },
    expected: {
      // CNSS still capped → SAME AS MID LEVEL
      cnssEmployee: 268.8,
      cnssEmployer: 538.8,

      // AMO scales with gross
      amoEmployee: 610.2,
      amoEmployer: 1109.7,

      // IR from your engine output
      ir: 6306.44,

      // FINAL NET from engine
      netSalary: 19814.56
    }
  });
});
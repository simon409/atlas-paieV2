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

function assertEqual(actual: number, expected: number, label: string) {
  const a = Math.round(actual * 100);
  const e = Math.round(expected * 100);

  if (a !== e) {
    throw new Error(
      `❌ ${label} mismatch\nExpected: ${expected}\nGot: ${actual}`
    );
  }
}

function runGoldenTest(testCase: GoldenCase) {
  const result = calculatePayroll(testCase.input, rules);

  try {
    assertEqual(result.cnssEmployee, testCase.expected.cnssEmployee, "CNSS Employee");
    assertEqual(result.cnssEmployer, testCase.expected.cnssEmployer, "CNSS Employer");

    assertEqual(result.amoEmployee, testCase.expected.amoEmployee, "AMO Employee");
    assertEqual(result.amoEmployer, testCase.expected.amoEmployer, "AMO Employer");

    assertEqual(result.irBrut, testCase.expected.ir, "IR");

    assertEqual(result.netSalary, testCase.expected.netSalary, "Net Salary");

    console.log(`✅ PASS: ${testCase.name}`);
  } catch (err: any) {
    console.error(`❌ FAIL: ${testCase.name}`);
    console.error(err.message);
    console.dir(result, { depth: null });
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
      ir: 43.04,
      netSalary: 3687.36
    }
  });
});
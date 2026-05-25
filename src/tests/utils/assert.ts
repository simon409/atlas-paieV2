export function assertApprox(actual: number, expected: number, label: string, tolerance = 0.01): void {
  const diff = Math.abs(actual - expected);

  if (diff > tolerance) {
    throw new Error(`${label} mismatch. Expected ${expected}, got ${actual}, diff ${diff}`);
  }
}

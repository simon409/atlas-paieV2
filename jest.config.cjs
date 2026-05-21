/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/payroll/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
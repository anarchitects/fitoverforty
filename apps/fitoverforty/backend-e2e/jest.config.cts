module.exports = {
  displayName: 'fitoverforty-backend-e2e',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/fitoverforty-backend-e2e',
};

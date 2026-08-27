const shared = require('../jest.shared.cjs');

module.exports = {
  displayName: 'fitoverforty-backend',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: shared.moduleNameMapper,
  setupFiles: shared.setupFiles,
  transformIgnorePatterns: shared.transformIgnorePatterns,
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/fitoverforty-backend',
};

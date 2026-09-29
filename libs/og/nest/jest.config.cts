const shared = require('../../../apps/fitoverforty/jest.shared.cjs');

module.exports = {
  displayName: 'fitoverforty-og-nest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  moduleNameMapper: shared.moduleNameMapper,
  setupFiles: shared.setupFiles,
  transformIgnorePatterns: shared.transformIgnorePatterns,
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/og/nest',
};

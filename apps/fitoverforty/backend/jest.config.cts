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
  moduleNameMapper: {
    '^@fitoverforty/content-model$':
      '<rootDir>/../../../libs/shared/content-model/src/index.ts',
  },
  transformIgnorePatterns: require('../jest.transform-ignore.cjs'),
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/fitoverforty-backend',
};

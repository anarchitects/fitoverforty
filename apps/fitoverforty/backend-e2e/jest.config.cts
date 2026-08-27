const shared = require('../jest.shared.cjs');

module.exports = {
  displayName: 'fitoverforty-backend-e2e',
  /**
   * Every suite here boots a whole Nest application in `beforeAll`, and Jest's
   * default of five seconds is not a realistic budget for that — it was already
   * marginal, and adding one more suite to the parallel pool tipped all of them
   * over at once.
   *
   * The failure that produces is actively misleading: "Exceeded timeout of 5000
   * ms for a hook", followed by `Cannot read properties of undefined (reading
   * 'close')` from the afterAll, on suites that are working perfectly well. A
   * budget generous enough to be about the app rather than about the machine
   * means a timeout here says something true.
   */
  testTimeout: 30_000,
  /**
   * One worker. These suites share a database and assert on global state.
   *
   * `blog read api` and `syndication` both check exact totals — how many posts
   * the archive holds, how many published posts carry each tag. Any suite that
   * publishes something while those run changes the answer, and the failure
   * lands on the innocent suite with no hint that another one caused it.
   *
   * Parallelism here was never actually safe; it was accidentally safe, because
   * a two-core CI runner makes Jest's default `cores - 1` equal one. A larger
   * runner would have broken CI with no code change at all. Saying it out loud
   * costs wall time and buys a suite that means what it says.
   *
   * It is also faster than it sounds: six Nest applications booting at once
   * contend badly enough that each `beforeAll` took a minute.
   */
  maxWorkers: 1,
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
  moduleNameMapper: shared.moduleNameMapper,
  setupFiles: shared.setupFiles,
  transformIgnorePatterns: shared.transformIgnorePatterns,
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/fitoverforty-backend-e2e',
};

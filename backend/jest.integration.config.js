module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/integration/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: false,
  coverageDirectory: 'coverage/integration',
  testTimeout: 60000,
  verbose: true,
  // Issue #1458: nakama-js 2.8.0 races every request against an internal
  // setTimeout(reject, timeoutMs) that it never clears once the request
  // settles, so each RPC leaves a pending timer behind. With
  // detectOpenHandles on, Jest prints ~115 "Timeout" open handles at exit
  // that read like hanging RPCs - they are leftover timers, not hangs.
  // The timers are internal to nakama-js and cannot be cleared from test
  // code, so open-handle detection is off and the runner force-exits once
  // the suite is done (same pattern as jest.config.js in CI). Genuine test
  // hangs still fail via testTimeout.
  detectOpenHandles: false,
  forceExit: true,
  detectLeaks: false,
  clearMocks: true,
  resetModules: false,
  restoreMocks: true,
  maxWorkers: 1,
  // Turn nakama-js `thrown: Response {}` rejections into Errors that carry
  // the HTTP status and body (tests/integration/unwrap_response_errors.ts).
  setupFilesAfterEnv: ['<rootDir>/tests/integration/unwrap_response_errors.ts'],
  // Issue #1144: emit machine-readable junit XML for the CI signal surface
  // (pass-rate summary, flake history, PR comment, dorny/test-reporter
  // annotations). jest-junit is wired as a reporter with inline options —
  // do NOT also set `testResultsProcessor: 'jest-junit'`: the reporter path
  // is the supported one (the processor path prints a deprecation warning)
  // and wiring both would write the file twice per run.
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        // classname = test file path → stable, greppable ids for the flake
        // history; name = "describe > test" full title.
        classNameTemplate: '{filepath}',
        titleTemplate: '{classname} {title}',
        ancestorSeparator: ' > ',
        includeConsoleOutput: 'false',
      },
    ],
  ],
  // Fix for uuid ES module compatibility (Issue #615)                                       
  // Map uuid to Node.js built-in crypto.randomUUID                                          
  moduleNameMapper: {                                                                        
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js'                                            
  },                                                                                         
  // Transform uuid package which uses ES module syntax                                      
  transformIgnorePatterns: [                                                                 
    '/node_modules/(?!(uuid)/)'                                                              
  ],                                                                                         
};

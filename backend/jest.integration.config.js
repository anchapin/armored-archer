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
  // Use detectOpenHandles to properly wait for async cleanup instead of forceExit
  detectOpenHandles: true,
  detectLeaks: false,
  clearMocks: true,
  resetModules: false,
  restoreMocks: true,
  maxWorkers: 1,
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

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

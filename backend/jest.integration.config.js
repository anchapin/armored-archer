module.exports = {                                                                           
  preset: 'ts-jest',                                                                         
  testEnvironment: 'node',                                                                   
  roots: ['<rootDir>'],                                                                      
  testMatch: ['**/tests/integration/**/*.test.ts'],                                          
  moduleFileExtensions: ['ts', 'js', 'json'],                                                
  collectCoverage: false,                                                                    
  coverageDirectory: 'coverage/integration',                                                 
  testTimeout: 60000,                                                                        
  verbose: true,                                                                             
  forceExit: true,                                                                           
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

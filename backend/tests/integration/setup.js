/**
 * Integration test setup file - runs after test environment is set up
 * Handles async cleanup for integration tests
 */

const { testHelper } = require('./helpers');

// Add proper async cleanup after each test file
afterAll(async () => {
  // Give any pending async operations a chance to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Clean up the test helper
  try {
    await testHelper.cleanup();
  } catch (error) {
    console.warn('Error during test helper cleanup:', error);
  }
  
  // Give a bit more time for handles to close
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Add cleanup after each test to ensure isolation
afterEach(async () => {
  // Small delay to allow any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

console.log('Integration test setup loaded - async cleanup configured');

/**
 * Jest setup file for integration tests - runs before test environment is set up
 * Loads .env file into environment variables
 */

const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

/**
 * Load .env file into environment variables (simplified dotenv)
 */
function loadEnvFile() {
  // __dirname is <rootDir>/backend in jest context, so .env is at the same level
  const envPath = join(__dirname, '.env');
  console.log('[setup] Loading .env from:', envPath);
  console.log('[setup] Exists:', existsSync(envPath));

  if (!existsSync(envPath)) {
    console.warn('[setup] .env file not found at', envPath);
    return;
  }

  try {
    const envContent = readFileSync(envPath, 'utf8');
    let count = 0;
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) return;
      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already defined (allow shell env vars to override)
      if (!process.env[key]) {
        process.env[key] = value;
        count++;
      }
    });
    console.log('[setup] Loaded', count, 'new env vars');
    console.log('[setup] NAKAMA_SERVER_KEY is now:', process.env.NAKAMA_SERVER_KEY);
  } catch (error) {
    console.warn('[setup] Failed to load .env file:', error);
  }
}

// Load .env file for integration tests
loadEnvFile();

/**
 * OpenAPI Specification Validator
 * 
 * Validates the OpenAPI specification file to ensure it's valid YAML
 * and conforms to the OpenAPI 3.0 specification structure.
 * 
 * Usage: node scripts/validate-openapi.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OPENAPI_SPEC_PATH = path.join(__dirname, '..', 'docs', 'openapi.yaml');

/**
 * Validate the OpenAPI specification file
 */
function validateOpenAPI() {
  console.log('Validating OpenAPI specification...');
  console.log(`Reading from: ${OPENAPI_SPEC_PATH}`);

  // Check if file exists
  if (!fs.existsSync(OPENAPI_SPEC_PATH)) {
    console.error(`ERROR: OpenAPI spec file not found at ${OPENAPI_SPEC_PATH}`);
    process.exit(1);
  }

  // Read the file
  const fileContent = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8');

  // Parse YAML
  let spec;
  try {
    spec = yaml.load(fileContent);
  } catch (yamlError) {
    console.error('ERROR: Invalid YAML syntax');
    console.error(yamlError.message);
    process.exit(1);
  }

  // Validate OpenAPI version
  if (!spec.openapi) {
    console.error('ERROR: Missing "openapi" field');
    process.exit(1);
  }

  const openapiVersion = spec.openapi;
  if (!openapiVersion.startsWith('3.')) {
    console.error(`ERROR: Only OpenAPI 3.x is supported, found: ${openapiVersion}`);
    process.exit(1);
  }

  // Validate required fields
  if (!spec.info) {
    console.error('ERROR: Missing "info" field');
    process.exit(1);
  }

  if (!spec.info.title) {
    console.error('ERROR: Missing "info.title" field');
    process.exit(1);
  }

  if (!spec.info.version) {
    console.error('ERROR: Missing "info.version" field');
    process.exit(1);
  }

  // Validate paths
  if (!spec.paths) {
    console.error('ERROR: Missing "paths" field');
    process.exit(1);
  }

  // Validate components/schemas if present
  if (spec.components && spec.components.schemas) {
    console.log(`Found ${Object.keys(spec.components.schemas).length} schema definitions`);
  }

  // Summary of validation
  console.log('\n✓ OpenAPI specification is valid!');
  console.log(`  - Version: ${openapiVersion}`);
  console.log(`  - Title: ${spec.info.title}`);
  console.log(`  - Version: ${spec.info.version}`);
  console.log(`  - Paths: ${Object.keys(spec.paths).length}`);
  
  if (spec.servers) {
    console.log(`  - Servers: ${spec.servers.length}`);
  }

  if (spec.tags) {
    console.log(`  - Tags: ${spec.tags.length}`);
  }

  return true;
}

// Run validation
try {
  validateOpenAPI();
} catch (error) {
  console.error('ERROR: Validation failed');
  console.error(error.message);
  process.exit(1);
}

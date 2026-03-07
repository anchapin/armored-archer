/**
 * OpenAPI Specification Generator
 * 
 * Generates and maintains OpenAPI documentation by extracting
 * type information from TypeScript source files and JSDoc comments.
 * 
 * This script creates a base OpenAPI specification that can be
 * manually maintained for more complex endpoints.
 * 
 * Usage: node scripts/generate-openapi.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OPENAPI_SPEC_PATH = path.join(DOCS_DIR, 'openapi.yaml');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

/**
 * Get all RPC function definitions from module files
 */
function getRpcEndpoints() {
  const endpoints = [];
  const modulesDir = path.join(SRC_DIR, 'modules');
  
  if (!fs.existsSync(modulesDir)) {
    console.warn('Warning: modules directory not found');
    return endpoints;
  }
  
  const files = fs.readdirSync(modulesDir);
  
  for (const file of files) {
    if (!file.endsWith('.ts') || file.includes('.test.') || file.includes('__tests__')) {
      continue;
    }
    
    const filePath = path.join(modulesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract RPC function names from registerRpcWithMetrics calls
    const rpcRegex = /registerRpcWithMetrics\s*\(\s*[^,]+,\s*['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = rpcRegex.exec(content)) !== null) {
      const rpcName = match[1];
      const moduleName = file.replace('.ts', '');
      
      endpoints.push({
        rpcName,
        moduleName,
        path: `/rpc/${rpcName}`
      });
    }
  }
  
  return endpoints;
}

/**
 * Extract type definitions from TypeScript source
 */
function extractTypeDefinitions() {
  const typesDir = path.join(SRC_DIR, 'types');
  const schemas = {};
  
  if (!fs.existsSync(typesDir)) {
    return schemas;
  }
  
  const files = fs.readdirSync(typesDir);
  
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    
    const filePath = path.join(typesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract interface definitions
    const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]+)}/g;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const body = match[2];
      
      // Parse properties
      const properties = {};
      const propRegex = /(\w+)(\??):\s*([^;]+);/g;
      let propMatch;
      
      while ((propMatch = propRegex.exec(body)) !== null) {
        const propName = propMatch[1];
        const optional = propMatch[2] === '?';
        const typeStr = propMatch[3].trim();
        
        properties[propName] = {
          type: mapTypeToOpenAPI(typeStr),
          description: extractPropertyDescription(content, propName)
        };
        
        if (optional) {
          properties[propName].nullable = true;
        }
      }
      
      if (Object.keys(properties).length > 0) {
        schemas[interfaceName] = {
          type: 'object',
          properties
        };
      }
    }
  }
  
  return schemas;
}

/**
 * Map TypeScript types to OpenAPI types
 */
function mapTypeToOpenAPI(typeStr) {
  const type = typeStr.trim();
  
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'any') return {};
  if (type === 'void' || type === 'undefined') return;
  
  if (type.startsWith('string[]')) return { type: 'array', items: { type: 'string' } };
  if (type.startsWith('number[]')) return { type: 'array', items: { type: 'number' } };
  if (type.startsWith('object[]')) return { type: 'array', items: { type: 'object' } };
  
  if (type.startsWith('Array<')) {
    const innerType = type.replace('Array<', '').replace('>', '');
    return { type: 'array', items: mapTypeToOpenAPI(innerType) };
  }
  
  if (type.includes('|')) {
    const enumValues = type.split('|').map(v => v.trim().replace(/['"]/g, ''));
    return { type: 'string', enum: enumValues };
  }
  
  if (type.includes('Record') || type.includes('object')) {
    return { type: 'object' };
  }
  
  // For custom types, return a reference
  return { type: type };
}

/**
 * Extract property description from JSDoc
 */
function extractPropertyDescription(content, propName) {
  // Look for JSDoc comment before property
  const propIndex = content.indexOf(propName);
  if (propIndex === -1) return undefined;
  
  const beforeProp = content.substring(0, propIndex);
  const lastJSDoc = beforeProp.lastIndexOf('/**');
  const lastClosing = beforeProp.lastIndexOf('*/');
  
  if (lastJSDoc === -1) return undefined;
  if (lastClosing > lastJSDoc) return undefined;
  
  const jsdoc = beforeProp.substring(lastJSDoc);
  const atPropertyMatch = jsdoc.match(/@property\s+(\w+)\s+-?\s*(.+)/);
  
  if (atPropertyMatch && atPropertyMatch[1] === propName) {
    return atPropertyMatch[2].trim();
  }
  
  // Try to extract from description
  const descMatch = jsdoc.match(/\*\s+(.+?)\n/);
  if (descMatch) {
    return descMatch[1].trim();
  }
  
  return undefined;
}

/**
 * Generate OpenAPI specification
 */
function generateOpenAPISpec() {
  console.log('Generating OpenAPI specification...');
  
  // Check if existing spec exists
  let existingSpec = null;
  if (fs.existsSync(OPENAPI_SPEC_PATH)) {
    const existingContent = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8');
    try {
      existingSpec = yaml.load(existingContent);
      console.log('Found existing OpenAPI specification, preserving manual entries');
    } catch (e) {
      console.warn('Warning: Could not parse existing spec, generating fresh');
    }
  }
  
  // Extract information from source code
  const endpoints = getRpcEndpoints();
  const schemas = extractTypeDefinitions();
  
  console.log(`Found ${endpoints.length} RPC endpoints`);
  console.log(`Found ${Object.keys(schemas).length} type definitions`);
  
  // Generate new spec or update existing
  const spec = existingSpec || {
    openapi: '3.0.3',
    info: {
      title: 'Armored Archer API',
      description: 'API documentation for the Armored Archer game backend.',
      version: '1.0.0'
    },
    servers: [
      { url: 'https://api.armoredarcher.com', description: 'Production server' },
      { url: 'https://staging-api.armoredarcher.com', description: 'Staging server' },
      { url: 'http://localhost:7350', description: 'Local development server' }
    ]
  };
  
  // Ensure paths object exists
  if (!spec.paths) {
    spec.paths = {};
  }
  
  // Add new endpoints to paths if not already present
  for (const endpoint of endpoints) {
    const pathKey = endpoint.path;
    
    if (!spec.paths[pathKey]) {
      spec.paths[pathKey] = {
        post: {
          tags: [capitalizeFirstLetter(endpoint.moduleName.replace('_', ' '))],
          summary: `RPC: ${endpoint.rpcName}`,
          description: `Auto-generated endpoint for ${endpoint.rpcName}`,
          operationId: endpoint.rpcName.replace('/', '_'),
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      };
    }
  }
  
  // Ensure components/schemas exists
  if (!spec.components) {
    spec.components = {};
  }
  if (!spec.components.schemas) {
    spec.components.schemas = {};
  }
  
  // Add new schemas
  for (const [name, schema] of Object.entries(schemas)) {
    if (!spec.components.schemas[name]) {
      spec.components.schemas[name] = schema;
    }
  }
  
  // Ensure security schemes
  if (!spec.components.securitySchemes) {
    spec.components.securitySchemes = {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    };
  }
  
  // Write the spec
  const yamlContent = yaml.dump(spec, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });
  
  fs.writeFileSync(OPENAPI_SPEC_PATH, yamlContent, 'utf8');
  
  console.log(`\n✓ OpenAPI specification written to: ${OPENAPI_SPEC_PATH}`);
  console.log(`  - Total paths: ${Object.keys(spec.paths).length}`);
  console.log(`  - Total schemas: ${Object.keys(spec.components.schemas).length}`);
  
  return spec;
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Run generation
try {
  generateOpenAPISpec();
} catch (error) {
  console.error('ERROR: Failed to generate OpenAPI specification');
  console.error(error.message);
  process.exit(1);
}

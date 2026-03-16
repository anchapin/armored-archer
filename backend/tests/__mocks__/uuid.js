/**
 * UUID mock for Jest integration tests
 * Fixes Issue #615: Jest cannot parse uuid ES module
 * Uses Node.js built-in crypto.randomUUID() instead
 */
const { randomUUID } = require('crypto');

module.exports = {
  v4: randomUUID,
  randomUUID: randomUUID,
  parse: (str) => str,
  stringify: (buf) => buf.toString(),
  NIL: '00000000-0000-0000-0000-000000000000',
  version: (str) => (str ? parseInt(str[14], 16) : undefined),
  validate: (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
};

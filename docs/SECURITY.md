# Security Considerations

## Input Sanitization

All user inputs to the backend RPC endpoints are validated and sanitized before processing. The `backend/src/modules/sanitization.ts` module provides:

- `sanitizeString()`: Escapes HTML/JS characters using `validator.escape()` to prevent injection attacks.
- `sanitizeUserId()`: Validates UUID format to ensure proper user identifier.
- `sanitizeNumber()`: Converts and validates numeric values within safe ranges.
- `escapeResponse()`: Recursively encodes all string values in API responses to prevent XSS.

The `backend/src/modules/validation.ts` module applies these sanitization functions to all relevant RPC payloads before validation. See `sanitizationMap` for the complete mapping.

## Output Encoding

All JSON responses from RPC endpoints are passed through `escapeResponse()` to ensure any potentially dangerous characters are encoded. This is applied consistently across all modules before `JSON.stringify()`.

## Testing

Comprehensive unit tests for sanitization functions are located in `backend/src/modules/__tests__/sanitization.test.ts`. Tests cover:

- HTML/JS escaping
- UUID validation
- Number range validation
- Non-string input handling
- Response encoding edge cases

## Dependencies

- `validator.js` (v13.15.26) for sanitization functions.

## Compliance

These measures protect against common injection vulnerabilities and ensure data integrity. All RPC handlers must use the provided validation and sanitization utilities.

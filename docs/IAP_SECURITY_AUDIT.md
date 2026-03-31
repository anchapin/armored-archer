# IAP Store Purchase System Security Audit

**Issue**: #144 - Security audit for IAP purchase validation and receipt verification needed  
**Date**: Security Audit Report  
**Status**: Findings & Recommendations

---

## Executive Summary

This document presents a comprehensive security audit of the In-App Purchase (IAP) system for Armored Archer, focusing on the RevenueCat integration and Nakama backend purchase validation. The audit identified several security gaps that should be addressed to prevent potential fraud and ensure robust purchase verification.

---

## Current Architecture

```
Client (Godot) → RevenueCat SDK → Apple/Google Stores → RevenueCat Backend → Nakama Server → Player Balance Update
```

### Components Reviewed

| Component | File | Purpose |
|-----------|------|---------|
| Client IAP | `autoloads/StoreManager.gd` | Initiates purchases, sends receipts to server |
| Backend Validation | `backend/src/modules/store.ts` | Validates receipts, awards gems |
| Input Validation | `backend/src/modules/validation.ts` | Zod schema validation |
| Rate Limiting | `backend/src/utils/rateLimiter.ts` | Request rate limits |
| Audit Logging | `backend/src/modules/audit.ts` | Transaction audit trail |

---

## Security Gaps Identified

### 🔴 CRITICAL: Missing RevenueCat Server-Side Validation

**Issue**: The backend does NOT validate receipts against RevenueCat's server-side API.

**Current Flow**:
1. Client receives receipt from RevenueCat SDK
2. Client sends receipt to Nakama `validate_purchase` RPC
3. Backend checks for duplicate receipts (local hash check)
4. Backend awards gems based on product_id

**Problem**: A malicious user could:
- Intercept a legitimate receipt
- Replay it multiple times (if hash not working correctly)
- Forge a purchase without paying by simulating a valid receipt format

**Recommendation**: Implement RevenueCat server-side receipt validation using the RevenueCat API:

```typescript
// In backend/src/modules/store.ts
import { validatePurchaseByReceipt } from '@revenuecat/server-side-verification';

async function validateWithRevenueCat(receipt: string, productId: string, platform: string): Promise<boolean> {
  try {
    const result = await validatePurchaseByReceipt({
      receipt,
      productId,
      platform: platform === 'ios' ? 'APPLE' : 'GOOGLE',
    });
    return result.isValid;
  } catch (error) {
    logger.error('RevenueCat validation failed:', error);
    return false;
  }
}
```

**Environment Variables Required**:
```bash
REVENUECAT_SECRET_KEY="your_revenuecat_secret_key"  # Server-side key
REVENUECAT_API_KEY="your_revenuecat_api_key"
```

---

### 🔴 CRITICAL: Weak Receipt Hashing Algorithm

**Issue**: The `hashReceipt()` function in `store.ts` uses a simple DJB2-style hash instead of cryptographic hashing.

**Current Implementation** (lines 78-87 in `store.ts`):
```typescript
function hashReceipt(receipt: string): string {
  let hash = 0;
  for (let i = 0; i < receipt.length; i++) {
    const char = receipt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
```

**Problems**:
- Not cryptographically secure (collision-prone)
- Only returns 32-bit integer (limited entropy)
- Can be reversed for short receipts

**Recommendation**: Use SHA-256 for receipt hashing:

```typescript
import { createHash } from 'crypto';

function hashReceipt(receipt: string): string {
  return createHash('sha256').update(receipt).digest('hex');
}
```

---

### 🟠 HIGH: In-Memory Receipt Storage (Not Distributed)

**Issue**: Validated receipts are stored in a JavaScript `Map` in memory.

**Current Implementation** (line 16 in `store.ts`):
```typescript
const validatedReceipts: Map<string, Set<string>> = new Map();
```

**Problems**:
- **Not persistent**: Lost on server restart
- **Not distributed**: In multi-server setup, each server has its own memory
- **Replay attacks possible**: If server restarts, same receipt can be replayed

**Recommendation**: Use Redis for distributed receipt storage with TTL:

```typescript
// Use Redis for distributed receipt storage
async function isReceiptAlreadyUsed(userId: string, receiptHash: string): Promise<boolean> {
  const key = `receipt:${userId}:${receiptHash}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

async function markReceiptAsUsed(userId: string, receiptHash: string): Promise<void> {
  const key = `receipt:${userId}:${receiptHash}`;
  // TTL: 24 hours (receipts generally shouldn't be valid longer)
  await redis.setEx(key, 86400, '1');
}
```

**Configuration**:
```bash
REDIS_HOST="your_redis_host"
REDIS_PORT=6379
```

---

### 🟠 HIGH: Platform Field Not Verified Against Receipt

**Issue**: The `platform` field is sent by the client and not verified against the actual receipt.

**Current Payload** (from `StoreManager.gd` line 224-228):
```gdscript
var payload = JSON.stringify({
    "product_id": product_id,
    "platform": platform,  # Client-provided, not verified!
    "transaction_receipt": transaction_receipt
})
```

**Problem**: A malicious user could send an iOS receipt with `platform: "android"` or vice versa.

**Recommendation**: 
1. Extract platform from the receipt itself during validation
2. Compare extracted platform with expected platform
3. Reject if mismatch

---

### 🟡 MEDIUM: RevenueCat Public Key Configured but Not Used

**Issue**: According to `ENVIRONMENTS.md`, `REVENUECAT_PUBLIC_KEY` is listed as a required variable, but it's not actually used in the backend code.

**Current State**: The backend stores `REVENUECAT_PUBLIC_KEY` in config but never calls RevenueCat API.

**Recommendation**: Either:
1. Remove the unused configuration, OR
2. Implement RevenueCat server-side validation (recommended)

---

### 🟡 MEDIUM: Audit Log IP Address Bug

**Issue**: In `store.ts`, IP addresses are logged using string literal instead of actual value.

**Bug Location** (lines 293-301, 330-339, 370-383):
```typescript
logAudit(
  nk,
  ctx.userId,
  `ctx.ipAddress ?? null`,  // BUG: String literal, not evaluated!
  // ...
)
```

**Note**: This bug is present throughout the store.ts file.

**Recommendation**: Fix to use actual context value:
```typescript
logAudit(
  nk,
  ctx.userId,
  ctx.ipAddress ?? null,  // Correct: evaluates to null or actual IP
  // ...
)
```

---

### 🟡 MEDIUM: Product ID Not Verified Against Receipt

**Issue**: The backend awards gems based on `product_id` from the client payload without verifying it matches the receipt.

**Current Flow**:
1. Client sends: `{ product_id: "com.armoredarcher.gems.small", receipt: "..." }`
2. Backend looks up product_id in GEM_BUNDLES
3. Backend awards gems for that product

**Problem**: A user could claim to have purchased a $9.99 product but send receipt for $0.99.

**Recommendation**: Verify the product_id in the receipt matches what was purchased:
- Parse the receipt to extract purchased product ID
- Compare with submitted product_id
- Reject if mismatch

---

### 🟢 LOW: Missing Purchase Timeout Handling

**Issue**: If server validation succeeds but client doesn't receive response, gems might be lost.

**Current**: If network fails after gems are awarded, there's no idempotency mechanism.

**Recommendation**: 
1. Use idempotency keys for purchase requests
2. Check if purchase was already processed before re-processing

---

## Security Features Already Implemented ✅

The following security measures are already in place:

| Feature | Location | Status |
|---------|----------|--------|
| Zod schema validation | `validation.ts` | ✅ Implemented |
| Duplicate receipt detection | `store.ts` | ✅ Implemented |
| Rate limiting | `rateLimiter.ts` | ✅ Implemented |
| Audit logging | `audit.ts` | ✅ Implemented |
| Platform restriction (mobile only) | `StoreManager.gd` | ✅ Implemented |
| Transaction receipt required | `StoreManager.gd` | ✅ Implemented |
| Server-authoritative currency | `store.ts` | ✅ Implemented |

---

## Recommendations Summary

### Immediate Actions (Critical)

1. **Implement RevenueCat Server-Side Validation**
   - Add RevenueCat server SDK
   - Validate all receipts against RevenueCat API
   - Configure `REVENUECAT_SECRET_KEY`

2. **Fix Receipt Hashing**
   - Replace DJB2 with SHA-256
   - Add cryptographic salt

3. **Use Redis for Receipt Storage**
   - Move from in-memory to Redis
   - Add TTL-based expiry

### Short-Term Actions (High Priority)

4. **Verify Platform Against Receipt**
   - Extract platform from receipt
   - Compare with submitted platform

5. **Verify Product ID Against Receipt**
   - Parse receipt to get actual product
   - Cross-check with submitted product_id

6. **Fix Audit Log IP Bug**
   - Replace string literal with actual context value

### Long-Term Improvements

7. **Add Purchase Idempotency**
   - Implement idempotency keys
   - Prevent double-spending

8. **Add Fraud Detection**
   - Monitor unusual purchase patterns
   - Flag accounts with high purchase frequency

---

## Test Scenarios to Implement

1. **Replay Attack Test**: Submit same receipt twice → should be rejected
2. **Invalid Receipt Test**: Submit fake receipt → should be rejected
3. **Platform Mismatch Test**: Submit iOS receipt with android platform → should be rejected
4. **Product Mismatch Test**: Submit receipt for small pack, claim large pack → should be rejected
5. **Rate Limiting Test**: Submit excessive purchase requests → should be throttled

---

## References

- [RevenueCat Server-Side Validation](https://docs.revenuecat.com/docs/server-side-api)
- [OWASP Mobile Security - In-App Purchase](https://owasp.org/www-project-mobile-security/)
- [Apple Receipt Validation](https://developer.apple.com/documentation/storekit/in-app_purchase/validating_receipts_with_the_app_store)
- [Google Play Billing Verification](https://developer.android.com/google/play/billing/security)

---

## Appendix: Files Modified in This Audit

| File | Review Status |
|------|---------------|
| `autoloads/StoreManager.gd` | Reviewed - Good |
| `backend/src/modules/store.ts` | Multiple issues found |
| `backend/src/modules/validation.ts` | Good - Zod schemas correct |
| `backend/src/modules/audit.ts` | Good - Core logic correct |
| `REVENUECAT_SETUP.md` | Needs update |
| `ENVIRONMENTS.md` | Needs RevenueCat secret key |

---

*End of Security Audit Report*

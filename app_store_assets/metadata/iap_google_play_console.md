# IAP Setup Guide: Google Play Console

Step-by-step guide for configuring in-app products in Google Play Console.

## Prerequisites

1. Complete merchant registration in Google Play Console ($25 one-time fee)
2. Set up a payment profile
3. Link your merchant account to the app

## Configuration Steps

### 1. Navigate to In-App Products

1. Open [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Monetize** > **In-app products**

### 2. Create Products

For each product in `iap_products.json`:

| Product ID | Type | Name | Price (USD) |
|------------|------|------|-------------|
| `com.armoredarcher.gems.small` | Consumable | Small Gem Pack | $0.99 |
| `com.armoredarcher.gems.medium` | Consumable | Medium Gem Pack | $4.99 |
| `com.armoredarcher.gems.large` | Consumable | Large Gem Pack | $9.99 |

### 3. For Each Product

1. Click **Create product**
2. Select **Consumable** product type
3. Enter the **Product ID** exactly as listed (must match the code)
4. Enter the **Name** (e.g., "Small Gem Pack")
5. Enter the **Description** (e.g., "100 Gems")
6. Set the **Price** in USD; Google auto-converts to local currencies
7. Add **multi-language listings**:
   - Copy from `iap_products.json` → `display_name` and `description` fields
   - Add at least English
8. Set **Status** to **Active**

### 4. License Testing

1. Go to **Setup** > **License testing**
2. Add Gmail accounts for testing
3. Set license response to **Licensed**
4. Test purchases will use test cards (no real charges)

### 5. RevenueCat Configuration

1. In RevenueCat dashboard, add Google Play integration:
   - Upload the service account JSON key
   - Add product identifiers
2. Link the Google Play Billing client in the game
3. See `docs/REVENUECAT_SETUP.md` for full setup

## Google Play Billing Notes

- All products are **managed consumable** products
- Google Play Billing Library handles the purchase flow
- RevenueCat wraps the billing client for cross-platform consistency
- Consumptions are acknowledged server-side via the backend `store.ts` module

## Verification

After setup, verify:

- [ ] All 3 products appear in Play Console as Active
- [ ] Product IDs match exactly: `com.armoredarcher.gems.small/medium/large`
- [ ] Test purchase completes with license testing account
- [ ] RevenueCat validates Google Play receipts
- [ ] Backend processes purchase and credits gems correctly
- [ ] Refund handling works (test via Play Console > Order Management)

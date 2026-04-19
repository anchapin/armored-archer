# IAP Setup Guide: Apple App Store Connect

Step-by-step guide for configuring in-app purchases in App Store Connect.

## Prerequisites

1. Sign the **Paid Applications Agreement** in App Store Connect (Agreements, Tax, and Banking)
2. Set up banking and tax information
3. Have an active Apple Developer Program membership ($99/year)

## Configuration Steps

### 1. Navigate to In-App Purchases

1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **Monetization** > **In-App Purchases**

### 2. Create Products

For each product in `iap_products.json`:

| Product ID | Type | Reference Name | Price Tier |
|------------|------|---------------|------------|
| `com.armoredarcher.gems.small` | Consumable | Small Gem Pack | Tier 1 ($0.99) |
| `com.armoredarcher.gems.medium` | Consumable | Medium Gem Pack | Tier 5 ($4.99) |
| `com.armoredarcher.gems.large` | Consumable | Large Gem Pack | Tier 10 ($9.99) |

### 3. For Each Product

1. Click **+** to create a new in-app purchase
2. Select type: **Consumable**
3. Enter the **Reference Name** (e.g., "Small Gem Pack")
4. Enter the **Product ID** exactly as listed above
5. Set the **Price** to the corresponding tier
6. Add **localized display names and descriptions** for each territory:
   - Copy from `iap_products.json` → `display_name` and `description` fields
   - At minimum, add English (U.S.)
7. Add a **review screenshot** showing the purchase UI in-game (1024x1024 or screenshot of store menu)
8. Add **Review Notes**: "Consumable gem pack for cosmetic items only. No gameplay advantages."

### 4. StoreKit Testing

1. Open **Users and Access** > **Sandbox** > **Test Accounts**
2. Create a sandbox tester account
3. On device: Settings > App Store > Sandbox Account
4. Test purchases in sandbox environment
5. The game already has sandbox detection in `StoreManager.gd` (auto-detects test mode)

### 5. RevenueCat Configuration

The game uses RevenueCat for purchase validation:

1. Create a project at [RevenueCat](https://www.revenuecat.com)
2. Configure App Store Connect integration:
   - Add the App Store Connect Shared Secret
   - Add in-app purchase product identifiers
3. Copy the RevenueCat API key to the game's environment configuration
4. See `docs/REVENUECAT_SETUP.md` for detailed setup

## Verification

After setup, verify:

- [ ] All 3 products appear in App Store Connect
- [ ] Product IDs match exactly: `com.armoredarcher.gems.small/medium/large`
- [ ] Localized names added for at least English
- [ ] Sandbox test purchase completes successfully
- [ ] RevenueCat receipt validation works end-to-end
- [ ] Backend `store.ts` correctly processes validated purchases

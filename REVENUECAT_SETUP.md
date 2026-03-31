# RevenueCat IAP Integration Setup Guide

This guide explains how to set up RevenueCat for in-app purchases in Armored Archer.

## Overview

RevenueCat is integrated to handle gem purchases (Small/Medium/Large Gem Packs) with server-authoritative receipt validation through Nakama.

## Architecture

```
Client (Godot) → RevenueCat SDK → Apple/Google Stores → RevenueCat Backend → Nakama Server (Receipt Validation) → Player Balance Update
```

## Step 1: Create RevenueCat Account

1. Go to https://www.revenuecat.com/ and create an account
2. Create a new project named "Armored Archer"
3. Note your RevenueCat API keys:
   - Public API Key (for client)
   - Secret API Key (for server - store securely!)

## Step 2: Configure Products in RevenueCat

1. In RevenueCat dashboard, navigate to "Products"
2. Add the following products:

### iOS Products (App Store Connect)
- **Product ID**: `com.armoredarcher.gems.small`
  - Reference Name: Small Gem Pack
  - Type: Consumable
  - Price: $0.99
  - Description: 100 Gems

- **Product ID**: `com.armoredarcher.gems.medium`
  - Reference Name: Medium Gem Pack
  - Type: Consumable
  - Price: $4.99
  - Description: 550 Gems

- **Product ID**: `com.armoredarcher.gems.large`
  - Reference Name: Large Gem Pack
  - Type: Consumable
  - Price: $9.99
  - Description: 1200 Gems

### Android Products (Google Play Console)
Use the same Product IDs as iOS for consistency:
- `com.armoredarcher.gems.small`
- `com.armoredarcher.gems.medium`
- `com.armoredarcher.gems.large`

Configure identical pricing and descriptions.

## Step 3: Install RevenueCat SDK

### iOS (Godot Export)

1. Install the RevenueCat iOS SDK via CocoaPods in your Xcode project after export:
   ```bash
   cd your_exported_xcode_project
   pod init
   # Add to Podfile:
   # pod 'RevenueCat'
   pod install
   ```

2. Create a native plugin or modify the iOS export template to integrate RevenueCat SDK.

### Android (Godot Export)

1. Add RevenueCat Android SDK to your gradle dependencies:
   ```groovy
   implementation 'com.revenuecat.purchases:purchases:7.x.x'
   ```

2. Create a Godot plugin using Kotlin to interface with RevenueCat.

### Alternative: Use a Godot RevenueCat Plugin

For easier integration, consider using a community Godot plugin:
- Search for "RevenueCat Godot plugin" on GitHub
- Follow the plugin's installation instructions
- Ensure it supports the required purchase methods

## Step 4: Configure StoreManager

The `StoreManager.gd` autoload handles IAP integration:

```gdscript
# Check if RevenueCat plugin is loaded
if Engine.has_singleton("RevenueCat"):
    var revenuecat = Engine.get_singleton("RevenueCat")
    # Initialize with your public API key
    revenuecat.configure("your_public_api_key")
```

### Important: Set Your API Key

Update `autoloads/StoreManager.gd` to include your RevenueCat configuration:

```gdscript
func _ready() -> void:
    _detect_platform()
    _initialize_revenuecat()
    if network_manager:
        network_manager.connected.connect(_on_connected)

func _initialize_revenuecat() -> void:
    if Engine.has_singleton("RevenueCat"):
        var revenuecat = Engine.get_singleton("RevenueCat")
        revenuecat.configure("YOUR_REVENUECAT_PUBLIC_API_KEY")
        revenuecat.setDebugLogsEnabled(true)  # Enable for debugging
```

## Step 5: Server-Side Configuration

The Nakama backend (`backend/src/modules/store.ts`) handles receipt validation:

1. Configure RevenueCat API access for server-side verification (optional)
   - RevenueCat handles most validation client-side
   - Server validates via transaction receipt to prevent spoofing

2. The backend RPCs:
   - `armored_archer/validate_purchase` - Validates receipt and awards gems
   - `armored_archer/get_currency` - Fetches current gem balance
   - `armored_archer/spend_gems` - Deducts gems for purchases

## Step 6: Configure Webhooks (Server-Side)

RevenueCat webhooks allow the server to receive real-time purchase notifications when:
- A new purchase is made
- A subscription is renewed
- A subscription is cancelled or expires
- A refund is processed
- Products are transferred between accounts

### Setting Up Webhooks

1. **Generate a Webhook Secret**
   - In RevenueCat dashboard, go to your project settings
   - Navigate to "Webhooks" or "API Keys"
   - Generate a new webhook secret (or use your existing secret key)
   - Note: This is different from your public API key

2. **Configure Environment Variables**

   Set the following environment variables in your Nakama configuration:

   ```bash
   # RevenueCat webhook secret for signature verification
   REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here

   # Optional: RevenueCat API key for server-side validation
   REVENUECAT_API_KEY=your_api_key_here
   ```

3. **Configure Webhook URL in RevenueCat**

   In your RevenueCat dashboard, configure the webhook URL:
   - Navigate to your project → Settings → Webhooks
   - Add webhook URL: `https://your-nakama-server.com/v2/rpc/armored_archer_revenuecat_webhook`
   - Note: The path should match your registered RPC endpoint

### Webhook Events Processed

The backend handles the following RevenueCat webhook events:

| Event Type | Description | Action |
|------------|-------------|--------|
| `initial_purchase` | New purchase | Award gems |
| `non_renewing_purchase` | One-time purchase | Award gems |
| `renewal` | Subscription renewal | Award gems (for consumables) |
| `cancellation` | Subscription cancelled | Log event |
| `expiration` | Subscription expired | Log event |
| `product_change` | Account transfer | Award gems to new account |
| `refund` | Refund processed | Deduct gems |
| `subscription_rc_auto_refund` | Auto refund | Deduct gems |

### Security

- Webhook signature verification is enabled when `REVENUECAT_WEBHOOK_SECRET` is configured
- The signature uses HMAC-SHA256 with the webhook secret
- Requests with invalid signatures are rejected
- Always keep your webhook secret secure!

## Step 7: Test Purchases (Sandbox)

### iOS Testing
1. Create Sandbox Testers in App Store Connect
2. Build and run on iOS device/simulator
3. Make test purchases using Sandbox account
4. Verify gems are awarded correctly

### Android Testing
1. Add a Google Play License Test account
2. Upload APK to Internal Testing track
3. Install and make test purchases
4. Verify gems are awarded correctly

### Desktop Testing
On desktop, the StoreManager simulates purchases for testing:
- Click any purchase button
- Gems are awarded after 1-second delay
- Uses mock receipt for server validation

## Product Identifiers Reference

| Product ID | Gem Amount | Price | Description |
|------------|-----------|-------|-------------|
| `com.armoredarcher.gems.small` | 100 | $0.99 | Small Gem Pack |
| `com.armoredarcher.gems.medium` | 550 | $4.99 | Medium Gem Pack |
| `com.armoredarcher.gems.large` | 1200 | $9.99 | Large Gem Pack |

## UI Access

The store UI is accessible via:
```gdscript
get_tree().change_scene_to_file("res://scenes/ui/store_menu.tscn")
```

Add a "Store" button to your main menu to access the purchase interface.

## Security Notes

- **Never commit API keys** to version control
- Use environment variables or secure config files for keys
- Server-authoritative validation prevents client-side cheating
- RevenueCat handles receipt validation with Apple/Google
- Server receives and validates the receipt before awarding gems

## Troubleshooting

### Purchases Fail
- Verify RevenueCat SDK is properly initialized
- Check network connectivity
- Ensure products are configured correctly in App Store Connect / Google Play Console
- Verify Product IDs match exactly

### Receipt Validation Fails
- Check Nakama server logs for error details
- Ensure platform detection is correct (ios/android)
- Verify transaction receipt format

### Gems Not Awarded
- Check if StoreManager is properly connected to Nakama
- Verify server RPC endpoints are registered
- Check player currency storage in Nakama

## Additional Resources

- RevenueCat Documentation: https://docs.revenuecat.com/
- Nakama RPC Documentation: https://heroiclabs.com/docs/nakama/server-framework/rpc/
- Godot IAP Best Practices: https://docs.godotengine.org/

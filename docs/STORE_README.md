# RevenueCat IAP Integration - Implementation Summary

This document provides an overview of the RevenueCat in-app purchase (IAP) integration implemented for Armored Archer.

## What Was Implemented

### 1. Backend (Nakama TypeScript)
**File**: `backend/src/modules/store.ts`

- **RPC Endpoints**:
  - `armored_archer/validate_purchase` - Validates purchase receipts and awards gems
  - `armored_archer/get_currency` - Retrieves player's gem and coins balance
  - `armored_archer/spend_gems` - Deducts gems for purchases

- **Product Definitions**:
  - Small Gem Pack (100 gems) - $0.99
  - Medium Gem Pack (550 gems) - $4.99
  - Large Gem Pack (1200 gems) - $9.99

- **Server-Authoritative Design**:
  - All gem transactions validated on server
  - Receipt validation prevents spoofing
  - Balance stored securely in Nakama storage

### 2. Client-Side (Godot GDScript)

#### StoreManager Autoload
**File**: `autoloads/StoreManager.gd`

Key Features:
- Platform detection (iOS, Android, Desktop)
- RevenueCat plugin integration hooks
- Purchase flow management
- Currency tracking and synchronization
- Server-side receipt validation
- Desktop simulation for testing

#### Store UI
**File**: `scenes/ui/store_menu.tscn` & `.gd`

Features:
- Display current gem and coins balance
- Three gem bundle purchase options
- Loading states and error handling
- Integration with both StoreManager and GemManager

#### Test Scene
**File**: `scenes/ui/store_test.tscn` & `.gd`

Features:
- Test all purchase types
- Verify server connectivity
- Check currency updates
- Detailed logging for debugging

### 3. Configuration Files

- **Product Config**: `data/products.json` - Defines all purchasable products
- **Environment Variables**: `data/.env.example` - Template for RevenueCat API keys
- **Main Menu Update**: Added "Buy Gems" button to access store

### 4. Documentation

- **Setup Guide**: `REVENUECAT_SETUP.md` - Complete setup instructions
- **Plugin Guide**: `REVENUECAT_PLUGIN.md` - Native plugin implementation details

## Architecture

```
┌─────────────────┐
│   Godot Client  │
│  (StoreManager) │
└────────┬────────┘
         │
         ├── RevenueCat Plugin (iOS/Android)
         │   └── App Store / Google Play
         │
         └── Nakama RPC
             └── Receipt Validation
                 └── Update Player Balance
```

## Server-Authoritative Flow

1. Player initiates purchase in-game
2. RevenueCat SDK handles purchase with Apple/Google
3. RevenueCat returns transaction receipt
4. Client sends receipt + product ID to Nakama server
5. Server validates receipt (or accepts trusted RevenueCat receipt)
6. Server awards gems to player's balance
7. Server updates Nakama storage and wallet
8. Client receives confirmation and updates UI

## Security Considerations

- ✅ Server validates all purchases
- ✅ Receipt validation prevents client-side manipulation
- ✅ Balance stored server-side in Nakama
- ✅ Client cannot directly modify gem balance
- ✅ API keys should be stored securely (never committed to Git)
- ✅ Sandbox mode for development/testing

## Integration Points

### Existing Systems

The store integrates with:
- **GemManager**: Synchronizes gem balance between server and client
- **NetworkManager**: Handles RPC communication with Nakama
- **Nakama Backend**: Validates purchases and stores balances

### Future Enhancements

Potential additions:
- Promotional offers and discounts
- First-time purchase bonuses
- Purchase history tracking
- Receipt restoration for device transfers
- Subscription tiers (if needed)

## Testing

### Desktop Testing
```gdscript
# StoreManager automatically simulates purchases on desktop
# No RevenueCat plugin required for basic testing
```

### Mobile Testing
1. Build for iOS/Android
2. Install RevenueCat plugin (see REVENUECAT_PLUGIN.md)
3. Test with sandbox accounts
4. Verify receipt validation on server

### Server Testing
```bash
# Start Nakama server
docker-compose up -d

# Test RPC endpoints via Nakama console
# or use the in-game test scene
```

## File Structure

```
armored-archer/
├── autoloads/
│   ├── StoreManager.gd          # Client-side IAP manager
│   └── GemManager.gd            # Existing gem/skin manager
├── backend/src/modules/
│   └── store.ts                 # Server-side validation
├── scenes/ui/
│   ├── store_menu.tscn/.gd      # Store UI
│   ├── store_test.tscn/.gd      # Test scene
│   └── main_menu.tscn/.gd      # Updated with Buy Gems button
├── data/
│   ├── products.json            # Product definitions
│   └── .env.example             # API key template
├── REVENUECAT_SETUP.md          # Setup instructions
└── REVENUECAT_PLUGIN.md         # Plugin implementation guide
```

## How to Use

### For Players

1. Access the store from main menu → "Buy Gems"
2. Select desired gem bundle
3. Complete purchase through platform's payment system
4. Gems are automatically added to balance (server-validated)

### For Developers

1. Set up RevenueCat account (see REVENUECAT_SETUP.md)
2. Configure products in App Store Connect / Google Play Console
3. Install RevenueCat plugin (see REVENUECAT_PLUGIN.md)
4. Add API keys to environment variables
5. Test in sandbox environment
6. Deploy to production

## Troubleshooting

### Purchase Fails
- Check NetworkManager connectivity
- Verify Nakama server is running
- Check store logs for error details
- Ensure products are configured correctly

### Balance Not Updating
- Verify StoreManager is connected to Nakama
- Check server logs for validation errors
- Ensure currency_updated signal is connected
- Refresh balance manually via test scene

### Plugin Not Found
- Install RevenueCat plugin (see REVENUECAT_PLUGIN.md)
- Verify plugin is registered in project settings
- Check platform detection

## Next Steps

To complete the integration:

1. **Create RevenueCat Account** - Get API keys
2. **Configure Products** - Set up in App Store Connect/Google Play
3. **Build Native Plugin** - Follow REVENUECAT_PLUGIN.md
4. **Test Thoroughly** - Use store_test scene
5. **Deploy to Production** - After successful sandbox testing

## Support

For issues or questions:
- RevenueCat Docs: https://docs.revenuecat.com/
- Nakama Docs: https://heroiclabs.com/docs/
- Godot Docs: https://docs.godotengine.org/
- Check logs in `scenes/ui/store_test.tscn` for detailed debugging

## License

This integration follows the same license as the Armored Archer project.

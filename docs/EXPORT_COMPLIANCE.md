# Export Compliance Documentation

## Overview

This document outlines the export compliance requirements for Armored Archer for submission to the Apple App Store and Google Play Store.

## Requirements Summary

- [ ] US Export Compliance
- [ ] EU Export Compliance
- [ ] Geo-restrictions (if needed)
- [ ] Documentation

---

## US Export Compliance (Apple App Store)

### Step 1: Determine Classification

Armored Archer uses:
- Standard HTTPS network connections (TLS 1.2+)
- Platform-provided encryption (iOS Keychain, Android Keystore)
- No custom cryptographic implementations

**Classification**: Commercially Available Crypto (CATEGORIZED EXEMPT)

### Step 2: Complete App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app > "App Information"
3. Under "Export Compliance":
   - Select **"No"** for "Does your app use non-exempt encryption?"
   - OR if using platform encryption: Select **"Yes"** and choose:
     - "Uses, includes, or incorporates: Commercial-grade cryptography or software"
     - "Platform-provided cryptographic services (iOS Keychain, Secure Enclave)"

### Step 3: Submit Classification

For games using only platform-provided encryption:
- No BIS (Bureau of Industry and Security) classification needed
- No CCATS (Classification Automated Tracking System) number required

---

## EU Export Compliance (Google Play)

### Step 1: Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app > "App content"
3. Navigate to "Export and encryption"

### Step 2: Encryption Classification

Answer the following:

| Question | Answer |
|----------|--------|
| Does your app use encryption? | Yes |
| Does your app use encryption beyond TLS/SSL? | No |
| Does your app use, contain, or incorporate cryptography? | Yes - Platform only |
| Export classification number (ECN) | Not required for exempt crypto |

### Step 3: Compliance Declaration

- Check "I confirm that my app uses only platform-provided cryptographic libraries"
- Check "My app does not implement any custom cryptographic algorithms"

---

## Geo-Restrictions (Optional)

If you need to restrict distribution:

### iOS (App Store Connect)
1. App Information > "Availability"
2. Select specific countries/regions

### Android (Google Play Console)
1. Pricing & Distribution > "Countries/Regions"
2. Uncheck countries where not available

---

## Technical Details for Submission

### Encryption Usage in Armored Archer

| Component | Encryption Type | Notes |
|-----------|----------------|-------|
| Network (Nakama) | TLS 1.2+ | Platform-provided |
| Authentication | Platform Keychain | iOS Keychain / Android Keystore |
| Local Storage | Platform encryption | Godot built-in |
| Player Data | AES-256 | Server-side only |

### BIS Classification Reference

If using custom encryption, reference:
- **EAR99** - Most common for mobile apps
- Export Administration Regulations (EAR)
- Bureau of Industry and Security: https://www.bis.gov

---

## Checklist

- [ ] Reviewed encryption usage in app
- [ ] Completed Apple App Store Connect export compliance
- [ ] Completed Google Play Console export compliance
- [ ] Documented encryption classification
- [ ] Set geo-restrictions (if needed)
- [ ] Saved compliance confirmation numbers

---

## Resources

- Apple Developer: [Export Compliance](https://developer.apple.com/documentation/security)
- Google Play: [Export Compliance](https://developer.android.com/distribute/play-as)
- BIS: https://www.bis.gov
- US Export Administration Regulations (EAR)

---

## Document History

- 2026-03-12: Initial export compliance documentation

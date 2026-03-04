# Export Compliance Certification

## Apple App Store Export Compliance

This document certifies the export compliance status of Armored Archer for Apple App Store submission.

### App Information
- **App Name**: Armored Archer
- **Bundle Identifier**: com.armoredarcher.game
- **Version**: 1.0.0
- **Build**: 1

### Export Compliance Certification

#### Cryptography

**Question**: Does your app use encryption? 
- **Answer**: Yes

**Question**: Does your app implement or use industry-standard encryption algorithms?
- **Answer**: Yes - Armored Archer uses industry-standard encryption for:
  - Secure network communication (TLS/SSL)
  - User authentication (bcrypt password hashing via Nakama backend)
  - Data at rest encryption via platform security features

**Question**: Is your app designed to be excluded from export controls?
- **Answer**: Yes

**Export Control Classification Number (ECCN)**: 
- **N/5.E2** - Information Security Software ( Encryption)

**Commodity Classification Advisory Number (CCAN)**: 
- **Not Required** - Self-classified under N/5.E2

### In-App Purchases

- **In-App Purchases Enabled**: Yes
- **Type**: Non-Consumable (Cosmetic skins, permanent unlocks)
- **Payment Processing**: RevenueCat (Third-party)
- **Apple Pay Integration**: No

### Encryption Details

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Network Transport | TLS 1.3 | Secure API communication |
| Password Storage | bcrypt | Secure authentication |
| Backend Storage | Platform-provided | Data at rest |

### Compliance Statements

1. **Export Laws**: This application complies with U.S. Export Administration Regulations (EAR) and other applicable export laws.

2. **Cryptography**:
   - The app uses encryption for security purposes only
   - Not designed for any specific government or military end-use
   - Uses publicly available, industry-standard encryption

3. **App Store Connect Settings**:
   - When submitting to App Store Connect, select "Yes" for encryption uses
   - Select "Not Exempt" for export compliance
   - This enables proper export classification for App Store distribution

### Required Actions for Submission

Before submitting to App Store Connect:

1. ✅ App uses encryption (TLS for network, bcrypt for auth)
2. ✅ Export compliance should be marked as:
   - "Does your app use encryption?" → **Yes**
   - "Does your app qualify for any of the exemptions provided in Category 5, Part 2?" → **No**
3. ✅ In-App Purchase compliance:
   - Ensure Paid Apps Agreement is signed in App Store Connect
   - Verify in-app purchase configuration in StoreKit

### References

- Apple App Store Review Guidelines: https://developer.apple.com/app-store-review/
- Export Compliance Guidelines: https://developer.apple.com/help/app-store-connect/reference/export-compliance
- Encryption Reporting: https://developer.apple.com/help/app-store-connect/manage-app-information/encryption-reporting

---

**Document Version**: 1.0.0
**Last Updated**: February 2025
**Certification Date**: [To be filled at time of submission]

---

*This document should be kept with your project records and updated for each major release.*

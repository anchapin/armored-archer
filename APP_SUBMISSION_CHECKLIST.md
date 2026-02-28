# Armored Archer - App Submission Checklist

This checklist covers all requirements for submitting Armored Archer to the iOS App Store and Google Play Store.

## Pre-Submission Checklist

### ✓ Build Preparation
- [ ] Build the iOS export (.ipa) using export_presets.cfg
- [ ] Build the Android export (.apk or .aab) using export_presets.cfg
- [ ] Test on physical devices:
  - [ ] iOS (iPhone with notch, iPhone with dynamic island, iPad)
  - [ ] Android (various screen sizes, different OS versions)
  - [ ] Test both portrait and landscape orientations
  - [ ] Test safe area handling (notches, punch holes)
- [ ] Run on simulators/emulators
- [ ] Verify no crashes during gameplay
- [ ] Test all game features end-to-end

### ✓ App Assets
- [ ] Create and add app icons in all required sizes
- [ ] Prepare screenshots (6-10 for iOS, 2-8 for Android)
  - [ ] Main menu/UI
  - [ ] Character selection screen
  - [ ] Combat gameplay
  - [ ] Gear inventory
  - [ ] Shop interface
  - [ ] PvP leaderboard
  - [ ] Stage selection
  - [ ] Character customization
- [ ] Prepare promotional images (1024x1024 for App Store, 1024x500 for Play Store)
- [ ] Verify icons display correctly on all devices

### ✓ Documentation
- [ ] Write app store descriptions (iOS and Android)
- [ ] Create privacy policy
- [ ] Write support email responses for common issues
- [ ] Prepare FAQ documentation
- [ ] Create release notes for version 1.0.0

---

## iOS App Store Submission

### ✓ Apple Developer Account Setup
- [ ] Create Apple Developer Program account ($99/year)
- [ ] Complete identity verification
- [ ] Set up two-factor authentication
- [ ] Read and understand App Store Review Guidelines

### ✓ App Store Connect Setup
- [ ] Create new app in App Store Connect
- [ ] Enter basic app information:
  - [ ] Platform (iOS)
  - [ ] Bundle Identifier (com.armoredarcher.game)
  - [ ] SKU (ARMORED_ARCHER_IOS_1)
  - [ ] User ID
- [ ] Upload app screenshots (6-10)
- [ ] Upload app icon (1024x1024)
- [ ] Add app description
- [ ] Set keywords
- [ ] Configure promotional URL (optional)
- [ ] Add marketing URL
- [ ] Add support URL
- [ ] Add privacy policy URL
- [ ] Set age rating
  - [ ] Answer content rating questions
  - [ ] Verify final rating (likely "12+")

### ✓ Build Upload
- [ ] Archive the project in Xcode
- [ ] Validate the archive
- [ ] Distribute to App Store Connect
- [ ] Wait for build processing to complete
- [ ] Verify build is visible in App Store Connect

### ✓ TestFlight Setup
- [ ] Create internal testing group
- [ ] Add team members as testers
- [ ] Upload beta build
- [ ] Send internal test invites
- [ ] Test on multiple iOS devices
- [ ] Gather feedback and fix issues
- [ ] Create external testing group (optional)
- [ ] Add up to 10,000 external testers
- [ ] Send external test invites

### ✓ App Store Information
- [ ] Set category: Games / Role Playing
- [ ] Configure subcategory if applicable
- [ ] Set age rating
- [ ] Add bundle ID
- [ ] Set version number (1.0.0)
- [ ] Add build version
- [ ] Set copyright information
- [ ] Add content rights (if applicable)

### ✓ App Review Preparation
- [ ] Review App Store Review Guidelines
- [ ] Verify no rejected features:
  - [ ] No in-app purchases for gameplay advantages
  - [ ] No gambling mechanics
  - [ ] No offensive content
  - [ ] Proper data collection disclosures
- [ ] Provide demo account (if required)
- [ ] Add review notes explaining unique features
- [ ] Provide contact information for review team
- [ ] Submit for review

### ✓ App Store Review
- [ ] Monitor review status
- [ ] Be ready to respond to review questions
- [ ] Fix any issues raised by review team
- [ ] Resubmit if rejected
- [ ] Approved! App goes live

---

## Google Play Store Submission

### ✓ Google Play Console Setup
- [ ] Create Google Play Console account ($25 one-time fee)
- [ ] Complete merchant registration (for in-app purchases)
- [ ] Set up payment profile
- [ ] Complete identity verification
- [ ] Read and understand Play Console policies

### ✓ App Creation
- [ ] Create new app in Google Play Console
- [ ] Enter app details:
  - [ ] App name: Armored Archer
  - [ ] Language: English
  - [ ] Category: Role Playing
  - [ ] Package name: com.armoredarcher.game
- [ ] Add app icons
- [ ] Upload feature graphic (1024x500)
- [ ] Upload screenshots (2-8)
- [ ] Add short description (80 characters max)
- [ ] Add full description
- [ ] Set content rating
  - [ ] Complete content rating questionnaire
  - [ ] Verify rating (likely "Teen")

### ✓ Store Listing
- [ ] Add title (30 characters max): Armored Archer
- [ ] Add short description
- [ ] Add full description
- [ ] Set category
- [ ] Add tags/keywords
- [ ] Add privacy policy URL
- [ ] Add support email
- [ ] Add website URL
- [ ] Set content rating
- [ ] Set age restrictions
- [ ] Add promotional content (optional)

### ✓ Release Management
- [ ] Create new release
- [ ] Upload signed APK or AAB (recommended)
  - [ ] Use Android App Bundle (AAB) for smaller downloads
  - [ ] Sign with release key (store securely!)
  - [ ] Test signed build on device
- [ ] Set release tracks:
  - [ ] Internal testing
  - [ ] Closed testing
  - [ ] Open testing
  - [ ] Production
- [ ] Add release notes
- [ ] Set version number
- [ ] Set version code

### ✓ Testing Setup
- [ ] Create internal testing track
- [ ] Add test accounts (up to 100)
- [ ] Upload internal testing build
- [ ] Distribute to internal testers
- [ ] Create closed testing track (optional)
- [ ] Add closed testers (up to 100)
- [ ] Upload closed testing build
- [ ] Distribute to closed testers
- [ ] Create open testing track (optional)
- [ ] Upload open testing build
- [ ] Distribute to open testers
- [ ] Gather feedback and fix issues

### ✓ Content Rating
- [ ] Complete content rating questionnaire
- [ ] Review and confirm rating
- [ ] Publish content rating

### ✓ Store Presence
- [ ] Upload promotional images
- [ ] Add screenshots (optimized for various device sizes)
- [ ] Add feature graphic
- [ ] Set app category
- [ ] Add store listing experiments (optional)

### ✓ Release to Production
- [ ] Ensure all tests pass
- [ ] Finalize production build
- [ ] Upload to production track
- [ ] Add release notes
- [ ] Set release date (immediate or scheduled)
- [ ] Submit for review
- [ ] Monitor review status
- [ ] Fix any issues raised
- [ ] Approved! App goes live

---

## Post-Launch Checklist

### ✓ Monitoring
- [ ] Set up Firebase Crashlytics to monitor crashes
- [ ] Monitor analytics for user behavior
- [ ] Check download numbers
- [ ] Monitor rating and reviews
- [ ] Respond to user reviews

### ✓ Support
- [ ] Set up support email
- [ ] Create FAQ documentation
- [ ] Prepare common issue responses
- [ ] Set up Discord community (optional)
- [ ] Create social media accounts

### ✓ Marketing
- [ ] Promote on social media
- [ ] Reach out to game review sites
- [ ] Create gameplay trailers
- [ ] Run paid advertising (optional)
- [ ] Partner with influencers (optional)

### ✓ Updates
- [ ] Plan content updates
- [ ] Track player feedback
- [ ] Fix critical bugs quickly
- [ ] Prepare for seasonal events
- [ ] Update documentation

---

## Important Notes

### Security
- **Never** share your private keys or signing certificates
- Store release keys securely (password manager, hardware key)
- Keep backup of signing certificates

### Timing
- iOS review takes 1-3 days
- Android review takes 1-7 days
- Submit both simultaneously to maximize launch impact

### Common Reasons for Rejection

**iOS:**
- Crashes or bugs
- Violations of design guidelines
- Missing required features
- Incorrect metadata
- Privacy policy issues

**Android:**
- Policy violations
- Malware or security issues
- Inappropriate content
- Misleading app description

### Contact Information

**Apple Support:**
- App Store Connect: https://appstoreconnect.apple.com
- Developer Support: [Add Apple support URL]

**Google Play Support:**
- Play Console: https://play.google.com/console
- Developer Support: https://support.google.com/googleplay/android-developer

---

**Good luck with your app submission! 🎮**

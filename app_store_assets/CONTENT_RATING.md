# Content Rating Reference

Pre-filled answers for the IARC (International Age Rating Coalition) questionnaire used by both Apple App Store and Google Play Store.

## IARC Questionnaire Answers

### Violence

| Question | Answer |
|----------|--------|
| Is there violence? | Yes |
| Type of violence | Fantasy violence (bows and arrows against fantasy creatures) |
| Is the violence realistic? | No — cartoon/stylized 2D art style |
| Is there blood or gore? | No |
| Is there depiction of human death? | No — enemies are fantasy creatures that disappear when defeated |
| Is there violence toward vulnerable groups? | No |

**Result:** Mild Fantasy Violence

### Language

| Question | Answer |
|----------|--------|
| Is there profanity or strong language? | No |
| Is there crude humor? | No |

**Result:** None

### Sexual Content

| Question | Answer |
|----------|--------|
| Is there sexual content? | No |
| Is there nudity? | No |
| Is there suggestive themes? | No |

**Result:** None

### Controlled Substances

| Question | Answer |
|----------|--------|
| Is there reference to alcohol, tobacco, or drugs? | No |
| Is there depiction of substance use? | No |

**Result:** None

### Gambling

| Question | Answer |
|----------|--------|
| Is there simulated gambling? | No |
| Are there loot boxes or random-chance mechanics? | No — all purchases are for specific known items |

**Result:** None

### User Interaction

| Question | Answer |
|----------|--------|
| Does the app allow user interaction? | Yes — asynchronous PvP battles and leaderboards |
| Is there direct messaging or chat? | No |
| Is there user-generated content? | No |
| Is there sharing of location data? | No |

**Result:** Limited (matchmaking and leaderboards only)

### In-App Purchases

| Question | Answer |
|----------|--------|
| Are there in-app purchases? | Yes |
| What can be purchased? | Virtual currency (gems) for cosmetic items only |
| Are purchases required to progress? | No — all gameplay content is accessible without purchases |
| Are there loot boxes? | No |

**Result:** Yes, cosmetic-only

### Data Collection

| Question | Answer |
|----------|--------|
| Does the app collect personal information? | Yes — email for account creation |
| Is data shared with third parties? | Only with service providers (Nakama, Firebase Crashlytics, RevenueCat) |
| Is data sold? | No |
| Does the app use advertising? | No |

## Expected Ratings

| Store | Rating | Notes |
|-------|--------|-------|
| Apple App Store | **12+** | Infrequent/Mild Fantasy Violence |
| Google Play Store | **Teen (T)** | Fantasy Violence, Simulated Gambling: None |
| PEGI (Europe) | **PEGI 12** | Violence toward fantasy characters |
| USK (Germany) | **USK 6** | Suitable for children 6+ |

## Submission Notes

- For **Apple**: Complete the questionnaire in App Store Connect under Age Rating. Select "Yes" for violence, "No" for all other categories.
- For **Google**: Complete the questionnaire in Play Console under Content Rating. The IARC tool will auto-generate ratings for all regions.
- Both stores require re-certification if content changes in future updates.

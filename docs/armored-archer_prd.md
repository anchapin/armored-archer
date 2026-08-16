# **Product Requirements Document (PRD)**

**Project Name:** Armored Archer (Working Title)  
**Platform:** iOS & Android (Cross-platform)  
**Monetization Model:** Free-to-Play (F2P), strictly Cosmetic Skins via In-App Purchases (IAP). Zero Pay-to-Win (P2W).  
**Genre:** Top-Down 2D ARPG / PvP Brawler

## **1\. Objective**

To build a highly engaging, 2D top-down mobile archery game with deep RPG progression. Players grind PvE campaigns to unlock powerful gear modifiers and level up their characters, then take those custom builds into high-stakes asynchronous PvP. Monetization is driven purely through cosmetic "skins" that can be applied over earned gear, ensuring a 100% fair, time-and-skill-based competitive environment.

## **2\. Target Audience**

Mid-core mobile gamers who enjoy ARPG progression, theory-crafting character builds, and competitive ranked ladders. Appeals to fans of *Diablo Immortal* (without the P2W), *Brotato*, and *Archero*.

## **3\. Core Gameplay Loop**

1. **Play (PvE):** Clear campaign chapters and defeat bosses to unlock unique modifiers and earn base gear/XP.  
2. **Play (PvP):** Compete in Casual (practice) or Ranked (high-stakes) asynchronous duels to climb the seasonal leaderboard.  
3. **Progress:** Level up the character, allocate Ability Points (Attack, Defense, Dodge, etc.), and equip earned gear (Helms, Armor, Bows, Arrows, Amulets).  
4. **Express (Monetization):** Spend premium currency (gems) to buy Cosmetic Skins that apply visually over the player's hard-earned gear.

## **4\. MVP Feature Set**

### **A. Combat & Controls**

* **Touch Controls:** Twin-stick mobile input (Left thumb: move, Right thumb: drag-to-aim/release-to-fire).  
* **PvE Campaign:** Progression-based stages ending in Boss encounters. Auto-aim mechanics are enabled to facilitate dodging and movement.  
* **Dynamic Difficulty:** Ratified for PvE only — reward-neutral, bounded within ±20%, and disclosed to the player. Adjusts challenge pacing only; never loot, XP, or drop rates.  
* **PvP Modes (Hybrid Duel Model):** Asynchronous matchmaking (challenge or queue, with a 24-hour acceptance window) precedes a live, short-session Duel — turn-based combat with 5-minute turn timers and reconnect grace.  
  * **Casual PvP:** Practice duels with reduced — but never negative — rewards; no Ladder Rating or season effect, and the Punch-Up wager is unavailable.  
  * **Ranked PvP:** Ladder system with a matchmaking toggle. Players can challenge similar opponents (standard risk/reward) or "Punch Up" against significantly more powerful ones.  
  * *Punch-Up:* Eligibility keys on Power Rating (minimum 20, Power Rating gap of 5–15 versus the opponent). Severity lands on Ladder Rating only — amplified upside on a win, amplified downside on a loss — never on XP or levels.

### **B. RPG Progression & Loadouts**

* **Character Leveling:** Gaining XP grants levels, which award Ability Points.  
* **Stat Allocation:** Players manually distribute Ability Points into core attributes (e.g., Attack Power, Physical Defense, Dodge Chance, Crit Rate).  
* **Gear System (5 Slots):** Helmets, Armor, Bows, Arrows, and Amulets.  
* **Modifiers:** Gear drops with specific stat modifiers.  
  * *Example:* Defeating the "Wind Boss" in PvE permanently unlocks the "Piercing Arrow" modifier drop pool.
* **Gear Rarity:** Base Gear drops across four earned-only tiers — Common, Rare, Epic, Legendary — scaling stat power and modifier quality. Rarity is never purchasable, and Cosmetic Skins carry no rarity.

### **C. The Economy & Rewards**

* **Currencies:**  
  * *Coins:* The earnable soft currency, paid out by matches and Season Rewards. Its primary sink ships Season 1 mid-season; Coins are never purchasable.  
  * *Gems:* The premium currency, bought with real money via IAP, plus small skill-gated earnable faucets (Punch-Up wins, season tiers). Gems buy Cosmetic Skins and nothing with stats.  
* **Seasonal Leaderboards:** A 4-week ranked ladder cycle on Ladder Rating.  
  * *Season Rewards:* Tiered payouts of Coins, Gems, and exclusive (non-stat) cosmetic titles or auras by final Standing — no XP component ("massive XP bursts" superseded).  
  * *Soft Reset:* Tiered Ladder Rating seeding into the next season based on final Standing.  
  * *Rank Decay:* Idle Ladder Rating erodes during inactivity.  
  * *Prestige Tiers:* Permanent cosmetic standing earned by repeated top season finishes.  
* **Separation of Stats and Cosmetics (Transmog):**  
  * *Base Gear:* Earned strictly by playing. Contains all the stats and modifiers.  
  * *Skins:* Bought with Gems. Alters the visual appearance of Base Gear without changing its stats.

## **5\. Technical Stack**

* **Frontend / Game Engine:** Godot 4.x (GDScript)  
* **Backend / Multiplayer API:** Nakama by Heroic Labs (TypeScript/Go for server logic)  
* **Database:** PostgreSQL (Managed via Nakama) \- *Updated to store complex player stats, ability point arrays, and generated gear hashes.*  
* **Monetization & IAP:** RevenueCat (Unified Apple/Google receipt validation)

## **6\. Architecture & Security (Server-Authoritative)**

* **Combat Calculation:** The Nakama backend must calculate all PvP damage. The Godot client sends the action ("Player shot arrow at 45 degrees"), and the server calculates the hit based on the attacker's server-stored Attack stats and the defender's server-stored Defense/Dodge stats.  
* **Loot Generation:** Drops are rolled securely on the server upon PvE stage completion to prevent client-side drop-rate hacking.  
* **Match Settlement:** Only the server declares a Duel's winner (health-zero, forfeit, or timeout) and finalizes Ladder Rating, XP, and reward payouts. The client may trigger Match Settlement, but never asserts outcomes.

## **7\. Out of Scope for MVP**

* Real-time synchronous PvP (deferred to avoid complex network prediction latency).  
* Player-to-player trading economy (prevents real-world money trading black markets).

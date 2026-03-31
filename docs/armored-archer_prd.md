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
* **PvP Modes (Asynchronous Turn-Based):**  
  * **Casual PvP:** Practice builds with no risk to rank or XP.  
  * **Ranked PvP:** Ladder system with a matchmaking toggle. Players can choose to challenge similar ranks (standard risk/reward) or "Punch Up" to challenge significantly higher ranks.  
  * *High-Stakes Wager:* Challenging a much higher rank yields massive XP/Rank rewards if won, but inflicts severe XP/Rank penalties if lost.

### **B. RPG Progression & Loadouts**

* **Character Leveling:** Gaining XP grants levels, which award Ability Points.  
* **Stat Allocation:** Players manually distribute Ability Points into core attributes (e.g., Attack Power, Physical Defense, Dodge Chance, Crit Rate).  
* **Gear System (5 Slots):** Helmets, Armor, Bows, Arrows, and Amulets.  
* **Modifiers:** Gear drops with specific stat modifiers.  
  * *Example:* Defeating the "Wind Boss" in PvE permanently unlocks the "Piercing Arrow" modifier drop pool.

### **C. The Economy & Rewards**

* **Seasonal Leaderboards:** Ending a PvP season at high ranks awards massive XP bursts and exclusive (non-stat) cosmetic titles or auras.  
* **Separation of Stats and Cosmetics (Transmog):**  
  * *Base Gear:* Earned strictly by playing. Contains all the stats and modifiers.  
  * *Skins:* Bought with premium currency. Alters the visual appearance of Base Gear without changing its stats.

## **5\. Technical Stack**

* **Frontend / Game Engine:** Godot 4.x (GDScript)  
* **Backend / Multiplayer API:** Nakama by Heroic Labs (TypeScript/Go for server logic)  
* **Database:** PostgreSQL (Managed via Nakama) \- *Updated to store complex player stats, ability point arrays, and generated gear hashes.*  
* **Monetization & IAP:** RevenueCat (Unified Apple/Google receipt validation)

## **6\. Architecture & Security (Server-Authoritative)**

* **Combat Calculation:** The Nakama backend must calculate all PvP damage. The Godot client sends the action ("Player shot arrow at 45 degrees"), and the server calculates the hit based on the attacker's server-stored Attack stats and the defender's server-stored Defense/Dodge stats.  
* **Loot Generation:** Drops are rolled securely on the server upon PvE stage completion to prevent client-side drop-rate hacking.

## **7\. Out of Scope for MVP**

* Real-time synchronous PvP (deferred to avoid complex network prediction latency).  
* Player-to-player trading economy (prevents real-world money trading black markets).

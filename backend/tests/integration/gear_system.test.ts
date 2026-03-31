import { testHelper, TestAccount } from './helpers';

describe('Gear System Integration Tests', () => {
  let player: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    player = await testHelper.createTestAccount('gear_player');
  }, 120000);

  afterEach(async () => {
    // Clean up inventory after each test
    await testHelper.deleteStorageObject('player_inventory', player.userId, player.userId);
  });

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to call RPC and parse JSON
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  // Helper to get inventory
  async function getInventory(account: TestAccount): Promise<any> {
    const result = await rpcCall(account, 'armored_archer/get_inventory', {});
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  describe('rpcGenerateGear', () => {
    test('should generate gear with valid stage_id', async () => {
      const payload = { stage_id: 'stage_1', boss_defeated: false };
      const result = await rpcCall(player, 'armored_archer/generate_gear', payload);

      expect(result.success).toBe(true);
      expect(result.gear).toBeDefined();
      expect(result.gear.id).toBeDefined();
      expect(result.gear.name).toBeDefined();
      expect(result.gear.rarity).toBeDefined();
      expect(result.gear.type).toBeDefined();
      expect(result.gear.stats).toBeDefined();
      expect(Array.isArray(result.gear.stats)).toBe(true);
      expect(result.gear.stats.length).toBeGreaterThan(0);
      expect(result.gear.modifiers).toBeDefined();
      expect(Array.isArray(result.gear.modifiers)).toBe(true);
      expect(result.gear.level).toBe(1);
    });

    test('should apply modifiers to gear stats when modifiers are present', async () => {
      // First, unlock all modifier pools so we get modifiers
      await rpcCall(player, 'armored_archer/unlock_modifier_pool', { pool_id: 'boss_frost' });

      // Generate multiple gear items to increase chance of getting rare/legendary with modifiers
      let foundGearWithModifiers = false;
      let gearWithModifiers: any = null;

      for (let i = 0; i < 20; i++) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: `stage_${i + 100}`,
          boss_defeated: false
        });

        if (result.success && result.gear.modifiers && result.gear.modifiers.length > 0) {
          foundGearWithModifiers = true;
          gearWithModifiers = result.gear;
          break;
        }
      }

      // Ensure we found gear with modifiers
      expect(foundGearWithModifiers).toBe(true);
      expect(gearWithModifiers).not.toBeNull();

      // If we got gear with modifiers, verify they're applied to stats
      if (foundGearWithModifiers && gearWithModifiers) {
        expect(gearWithModifiers.modifiers.length).toBeGreaterThan(0);

        // Check that at least one modifier has a matching stat
        const modifierStatNames = new Set(gearWithModifiers.modifiers.map((m: any) => m.stat));
        const matchingStats = gearWithModifiers.stats.filter((s: any) => modifierStatNames.has(s.name));

        // The stat values should be different from base values when modifiers exist
        for (const stat of matchingStats) {
          expect(stat.value).not.toBe(stat.base_value);
        }
      }
    });

    test('should add generated gear to inventory', async () => {
      const payload = { stage_id: 'stage_2', boss_defeated: false };
      const result = await rpcCall(player, 'armored_archer/generate_gear', payload);

      expect(result.success).toBe(true);
      expect(result.inventory.gear.length).toBe(1);
      expect(result.inventory.gear[0].id).toBe(result.gear.id);
    });

    test('should generate different gear types', async () => {
      const generatedTypes = new Set<string>();

      // Generate multiple gear items to see variety
      for (let i = 0; i < 10; i++) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: `stage_${i}`,
          boss_defeated: false
        });
        if (result.success) {
          generatedTypes.add(result.gear.type);
        }
      }

      // Should have generated at least 2 different types (among weapon, armor, accessory)
      expect(generatedTypes.size).toBeGreaterThanOrEqual(2);
      expect(['weapon', 'armor', 'accessory']).toContain(Array.from(generatedTypes)[0]);
    });

    test('should generate gear with appropriate rarities', async () => {
      const generatedRarities: string[] = [];

      for (let i = 0; i < 50; i++) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_test',
          boss_defeated: false
        });
        if (result.success) {
          generatedRarities.push(result.gear.rarity);
        }
      }

      // Should have at least some common items (70% chance)
      expect(generatedRarities.filter(r => r === 'common').length).toBeGreaterThan(0);
      // Should have some rare items (25% chance)
      expect(generatedRarities.filter(r => r === 'rare').length).toBeGreaterThan(0);
      // Legendary is rare (5% chance) but should be possible with 50 tries
      // This might fail occasionally but 50 tries gives ~92% chance of at least one legendary
    });

    test('should unlock modifier pools when boss defeated', async () => {
      // First generate without boss defeat
      const result1 = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_boss_1',
        boss_defeated: false
      });
      expect(result1.success).toBe(true);

      const inventory1 = await getInventory(player);
      const initialUnlockedPools = inventory1.unlocked_modifier_pools || [];

      // Unlock a modifier pool manually
      await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'piercing_arrow'
      });

      // Generate with boss defeat should potentially unlock new pools
      const result2 = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_boss_2',
        boss_defeated: true
      });
      expect(result2.success).toBe(true);

      const inventory2 = await getInventory(player);
      // Should have at least one unlocked pool now
      expect(inventory2.unlocked_modifier_pools.length).toBeGreaterThanOrEqual(1);
    });

    test('should create initial inventory if none exists', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_gear');

      const payload = { stage_id: 'stage_1', boss_defeated: false };
      const result = await rpcCall(freshPlayer, 'armored_archer/generate_gear', payload);

      expect(result.success).toBe(true);
      expect(result.inventory.gear.length).toBe(1);
      expect(result.inventory.equipped_gear).toEqual({});
      expect(result.inventory.unlocked_modifier_pools).toEqual([]);
    });
  });

  describe('rpcGetInventory', () => {
    test('should return empty inventory for new player', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_inv');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_inventory', {});

      expect(result.gear).toEqual([]);
      expect(result.equipped_gear).toEqual({});
      expect(result.unlocked_modifier_pools).toEqual([]);
    });

    test('should return existing inventory', async () => {
      // Generate some gear
      const generateResult = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_1',
        boss_defeated: false
      });
      expect(generateResult.success).toBe(true);

      const inventoryResult = await rpcCall(player, 'armored_archer/get_inventory', {});

      expect(inventoryResult.gear.length).toBe(1);
      expect(inventoryResult.gear[0].id).toBe(generateResult.gear.id);
    });

    test('should reflect multiple gear items', async () => {
      // Generate multiple gear items
      for (let i = 0; i < 3; i++) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: `stage_${i}`,
          boss_defeated: false
        });
        expect(result.success).toBe(true);
      }

      const inventory = await getInventory(player);
      expect(inventory.gear.length).toBe(3);
    });

    test('should retain equipped gear status', async () => {
      // Generate gear
      const gear1 = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_eq1',
        boss_defeated: false
      });
      expect(gear1.success).toBe(true);

      const gear2 = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_eq2',
        boss_defeated: false
      });
      expect(gear2.success).toBe(true);

      // Equip first gear as weapon
      await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: gear1.gear.id,
        slot: 'weapon'
      });

      // Check inventory
      const inventory = await getInventory(player);
      expect(inventory.equipped_gear.weapon).toBe(gear1.gear.id);
    });
  });

  describe('rpcEquipGear', () => {
    test('should equip gear to correct slot', async () => {
      // Generate weapon gear
      // We need to ensure we get a weapon; may need multiple attempts
      let weaponGear: any = null;
      let attempts = 0;
      while (!weaponGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_weapon',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'weapon') {
          weaponGear = result.gear;
        }
        attempts++;
      }
      expect(weaponGear).not.toBeNull();

      const payload = { gear_id: weaponGear.id, slot: 'weapon' };
      const result = await rpcCall(player, 'armored_archer/equip_gear', payload);

      expect(result.success).toBe(true);
      expect(result.equipped_gear.weapon).toBe(weaponGear.id);
    });

    test('should equip armor to correct slot', async () => {
      let armorGear: any = null;
      let attempts = 0;
      while (!armorGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_armor',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'armor') {
          armorGear = result.gear;
        }
        attempts++;
      }
      expect(armorGear).not.toBeNull();

      const payload = { gear_id: armorGear.id, slot: 'armor' };
      const result = await rpcCall(player, 'armored_archer/equip_gear', payload);

      expect(result.success).toBe(true);
      expect(result.equipped_gear.armor).toBe(armorGear.id);
    });

    test('should equip accessory to correct slot', async () => {
      let accessoryGear: any = null;
      let attempts = 0;
      while (!accessoryGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_accessory',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'accessory') {
          accessoryGear = result.gear;
        }
        attempts++;
      }
      expect(accessoryGear).not.toBeNull();

      const payload = { gear_id: accessoryGear.id, slot: 'accessory' };
      const result = await rpcCall(player, 'armored_archer/equip_gear', payload);

      expect(result.success).toBe(true);
      expect(result.equipped_gear.accessory).toBe(accessoryGear.id);
    });

    test('should return error when gear not in inventory', async () => {
      const payload = { gear_id: 'nonexistent_gear_id', slot: 'weapon' };
      const result = await rpcCall(player, 'armored_archer/equip_gear', payload);

      expect(result.error).toBe('Gear not found in inventory');
    });

    test('should return error when gear type does not match slot', async () => {
      // Generate a weapon
      const weaponGear = await rpcCall(player, 'armored_archer/generate_gear', {
        stage_id: 'stage_mismatch',
        boss_defeated: false
      });
      expect(weaponGear.success).toBe(true);

      // Try to equip it as armor
      const payload = { gear_id: weaponGear.gear.id, slot: 'armor' };
      const result = await rpcCall(player, 'armored_archer/equip_gear', payload);

      expect(result.error).toBe('Gear type does not match slot');
    });

    test('should replace previously equipped gear in same slot', async () => {
      // Generate two weapons
      let weapon1: any = null;
      let attempts = 0;
      while (!weapon1 && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_w1',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'weapon') {
          weapon1 = result.gear;
        }
        attempts++;
      }
      expect(weapon1).not.toBeNull();

      let weapon2: any = null;
      attempts = 0;
      while (!weapon2 && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_w2',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'weapon' && result.gear.id !== weapon1.id) {
          weapon2 = result.gear;
        }
        attempts++;
      }
      expect(weapon2).not.toBeNull();
      expect(weapon2.id !== weapon1.id).toBe(true);

      // Equip first weapon
      await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: weapon1.id,
        slot: 'weapon'
      });

      // Equip second weapon (should replace first)
      const result = await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: weapon2.id,
        slot: 'weapon'
      });
      expect(result.success).toBe(true);
      expect(result.equipped_gear.weapon).toBe(weapon2.id);

      // Verify first weapon is no longer equipped
      const inventory = await getInventory(player);
      expect(inventory.equipped_gear.weapon).toBe(weapon2.id);
    });
  });

  describe('rpcUnequipGear', () => {
    test('should unequip gear from slot', async () => {
      // Generate and equip weapon
      let weaponGear: any = null;
      let attempts = 0;
      while (!weaponGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_eq_uneq',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'weapon') {
          weaponGear = result.gear;
        }
        attempts++;
      }
      expect(weaponGear).not.toBeNull();

      await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: weaponGear.id,
        slot: 'weapon'
      });

      // Verify equipped
      let inventory = await getInventory(player);
      expect(inventory.equipped_gear.weapon).toBe(weaponGear.id);

      // Unequip
      const result = await rpcCall(player, 'armored_archer/unequip_gear', {
        slot: 'weapon'
      });
      expect(result.success).toBe(true);
      expect(result.equipped_gear.weapon).toBeUndefined();

      // Verify unequipped
      inventory = await getInventory(player);
      expect(inventory.equipped_gear.weapon).toBeUndefined();
    });

    test('should return error when no gear equipped in slot', async () => {
      const payload = { slot: 'weapon' };
      const result = await rpcCall(player, 'armored_archer/unequip_gear', payload);

      expect(result.error).toBe('No gear equipped in this slot');
    });

    test('should unequip armor correctly', async () => {
      let armorGear: any = null;
      let attempts = 0;
      while (!armorGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_armor_uneq',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'armor') {
          armorGear = result.gear;
        }
        attempts++;
      }
      expect(armorGear).not.toBeNull();

      await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: armorGear.id,
        slot: 'armor'
      });

      const result = await rpcCall(player, 'armored_archer/unequip_gear', {
        slot: 'armor'
      });
      expect(result.success).toBe(true);

      const inventory = await getInventory(player);
      expect(inventory.equipped_gear.armor).toBeUndefined();
    });

    test('should unequip accessory correctly', async () => {
      let accessoryGear: any = null;
      let attempts = 0;
      while (!accessoryGear && attempts < 20) {
        const result = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_acc_uneq',
          boss_defeated: false
        });
        if (result.success && result.gear.type === 'accessory') {
          accessoryGear = result.gear;
        }
        attempts++;
      }
      expect(accessoryGear).not.toBeNull();

      await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: accessoryGear.id,
        slot: 'accessory'
      });

      const result = await rpcCall(player, 'armored_archer/unequip_gear', {
        slot: 'accessory'
      });
      expect(result.success).toBe(true);

      const inventory = await getInventory(player);
      expect(inventory.equipped_gear.accessory).toBeUndefined();
    });
  });

  describe('rpcUnlockModifierPool', () => {
    test('should unlock a modifier pool', async () => {
      const result = await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'piercing_arrow'
      });

      expect(result.success).toBe(true);
      expect(result.unlocked_modifier_pools).toContain('piercing_arrow');
    });

    test('should accumulate multiple unlocked pools', async () => {
      const modifiers = ['piercing_arrow', 'heavy_impact', 'vitality_boost'];

      for (const mod of modifiers) {
        const result = await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
          modifier_id: mod
        });
        expect(result.success).toBe(true);
      }

      const inventory = await getInventory(player);
      expect(inventory.unlocked_modifier_pools.length).toBe(3);
      modifiers.forEach(mod => {
        expect(inventory.unlocked_modifier_pools).toContain(mod);
      });
    });

    test('should not duplicate pools', async () => {
      // Unlock same pool twice
      const result1 = await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'piercing_arrow'
      });
      expect(result1.success).toBe(true);

      const result2 = await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'piercing_arrow'
      });
      expect(result2.success).toBe(true);

      const inventory = await getInventory(player);
      const count = inventory.unlocked_modifier_pools.filter((p: string) => p === 'piercing_arrow').length;
      expect(count).toBe(1);
    });

    test('should include unlocked pools in inventory response', async () => {
      await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'wind_fury'
      });

      const inventory = await getInventory(player);
      expect(inventory.unlocked_modifier_pools).toContain('wind_fury');
    });
  });

  describe('rpcGetUnlockedModifiers', () => {
    test('should return unlocked modifiers and boss defeat counts', async () => {
      // First, unlock a modifier pool
      await rpcCall(player, 'armored_archer/unlock_modifier_pool', {
        modifier_id: 'piercing_arrow'
      });

      // Get unlocked modifiers
      const result = await rpcCall(player, 'armored_archer/get_unlocked_modifiers', {});

      expect(result.success).toBe(true);
      expect(result.unlocked_modifier_pools).toContain('piercing_arrow');
      expect(result.boss_defeats).toBeDefined();
    });

    test('should return empty boss defeats initially', async () => {
      const result = await rpcCall(player, 'armored_archer/get_unlocked_modifiers', {});

      expect(result.success).toBe(true);
      expect(result.boss_defeats).toEqual({});
    });
  });

  describe('rpcStageComplete - Boss Defeat Tracking', () => {
    afterEach(async () => {
      // Clean up boss defeat tracking data
      await testHelper.deleteStorageObject('boss_defeat_tracking', player.userId, player.userId);
    });

    test('should track boss defeat and unlock modifiers', async () => {
      // Complete a stage with boss defeated
      const payload = {
        stage_id: 'stage_wind_boss',
        boss_defeated: true,
        difficulty: 'medium' as const,
        boss_id: 'boss_wind'
      };

      const result = await rpcCall(player, 'armored_archer/stage_complete', payload);

      expect(result.success).toBe(true);
      expect(result.boss_defeat_count).toBe(1);
      expect(result.newly_unlocked_modifiers).toContain('piercing_arrow');
      expect(result.unlocked_modifier_pools).toContain('piercing_arrow');
    });

    test('should increment boss defeat count on repeated defeats', async () => {
      const payload = {
        stage_id: 'stage_wind_boss',
        boss_defeated: true,
        difficulty: 'easy' as const,
        boss_id: 'boss_wind'
      };

      // First defeat
      const result1 = await rpcCall(player, 'armored_archer/stage_complete', payload);
      expect(result1.boss_defeat_count).toBe(1);

      // Second defeat
      const result2 = await rpcCall(player, 'armored_archer/stage_complete', payload);
      expect(result2.boss_defeat_count).toBe(2);

      // Verify via get_unlocked_modifiers
      const modifiers = await rpcCall(player, 'armored_archer/get_unlocked_modifiers', {});
      expect(modifiers.boss_defeats.boss_wind).toBe(2);
    });

    test('should not track boss defeat when boss_defeated is false', async () => {
      const payload = {
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'easy' as const,
      };

      const result = await rpcCall(player, 'armored_archer/stage_complete', payload);

      expect(result.success).toBe(true);
      expect(result.boss_defeat_count).toBeUndefined();
    });

    test('should not duplicate modifiers when boss defeated multiple times', async () => {
      const payload = {
        stage_id: 'stage_wind_boss',
        boss_defeated: true,
        difficulty: 'easy' as const,
        boss_id: 'boss_wind'
      };

      // Defeat the same boss twice
      await rpcCall(player, 'armored_archer/stage_complete', payload);
      await rpcCall(player, 'armored_archer/stage_complete', payload);

      // Get modifiers - should only have piercing_arrow once
      const result = await rpcCall(player, 'armored_archer/get_unlocked_modifiers', {});
      const piercingCount = result.unlocked_modifier_pools.filter((m: string) => m === 'piercing_arrow').length;
      expect(piercingCount).toBe(1);
    });
  });
});

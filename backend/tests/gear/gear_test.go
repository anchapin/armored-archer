package gear_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/gear"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestRollRarity(t *testing.T) {
	// Run multiple times to account for randomness
	rarityCounts := make(map[string]int)
	runs := 10000

	for i := 0; i < runs; i++ {
		rarity := gear.RollRarity()
		rarityCounts[rarity]++
	}

	// Common should be most frequent (~70%)
	commonRate := float64(rarityCounts[gear.RarityCommon]) / float64(runs)
	testhelpers.AssertTrue(t, commonRate >= 0.6 && commonRate <= 0.8,
		"Common rate should be around 70%")

	// Rare should be less frequent (~25%)
	rareRate := float64(rarityCounts[gear.RarityRare]) / float64(runs)
	testhelpers.AssertTrue(t, rareRate >= 0.2 && rareRate <= 0.3,
		"Rare rate should be around 25%")
}

func TestGenerateGearItem(t *testing.T) {
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)

	testhelpers.AssertTrue(t, len(gearItem.ID) > 0, "Gear ID should not be empty")
	testhelpers.AssertEqual(t, "user123", gearItem.OwnerID, "OwnerID should match")
	testhelpers.AssertEqual(t, gear.GearTypeBow, gearItem.Type, "Type should match")
	testhelpers.AssertTrue(t, len(gearItem.Name) > 0, "Name should not be empty")
	testhelpers.AssertTrue(t, len(gearItem.Stats) > 0, "Should have stats")
	testhelpers.AssertEqual(t, 1, gearItem.Level, "Level should be 1")
}

func TestGenerateGearItemWithBoss(t *testing.T) {
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeArmor, true)

	// Boss defeated should give more modifiers
	testhelpers.AssertTrue(t, len(gearItem.Modifiers) >= 1,
		"Should have at least 1 modifier when boss defeated")
}

func TestGenerateGearStats(t *testing.T) {
	stats := gear.GenerateGearStats(gear.GearTypeBow, gear.RarityRare)

	testhelpers.AssertTrue(t, len(stats) > 0, "Should have stats")

	// Bow should have attack and crit_rate
	hasAttack := false
	hasCrit := false
	for _, stat := range stats {
		if stat.Name == "attack" {
			hasAttack = true
		}
		if stat.Name == "crit_rate" {
			hasCrit = true
		}
	}
	testhelpers.AssertTrue(t, hasAttack, "Bow should have attack stat")
	testhelpers.AssertTrue(t, hasCrit, "Bow should have crit_rate stat")
}

func TestApplyModifiers(t *testing.T) {
	gearItem := &gear.GearItem{
		ID:     "gear123",
		Name:   "Test Bow",
		Rarity: gear.RarityRare,
		Type:   gear.GearTypeBow,
		Stats: []gear.GearStat{
			{Name: "attack", BaseValue: 10, Value: 10},
		},
		Modifiers: []gear.GearModifier{
			{ID: "mod1", Stat: "attack", ValueRange: [2]int{5, 5}},
		},
	}

	gear.ApplyModifiers(gearItem)

	// Attack should be increased by modifier
	for _, stat := range gearItem.Stats {
		if stat.Name == "attack" {
			testhelpers.AssertTrue(t, stat.Value > stat.BaseValue,
				"Modifier should increase stat value")
		}
	}
}

func TestPlayerInventory(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")

	testhelpers.AssertEqual(t, "user123", inv.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 0, len(inv.Gear), "Initial gear should be empty")
	testhelpers.AssertEqual(t, 0, len(inv.EquippedGear), "Initial equipped gear should be empty")
}

func TestInventoryAddGear(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)

	err := inv.AddGear(gearItem)
	testhelpers.AssertNoError(t, err, "Should add gear")
	testhelpers.AssertEqual(t, 1, len(inv.Gear), "Should have 1 gear item")

	// Test adding gear with wrong owner
	wrongOwnerGear := gear.GenerateGearItem("other_user", gear.GearTypeBow, false)
	err = inv.AddGear(wrongOwnerGear)
	testhelpers.AssertError(t, err, "Should fail to add gear with wrong owner")
}

func TestInventoryRemoveGear(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)

	err := inv.RemoveGear(gearItem.ID)
	testhelpers.AssertNoError(t, err, "Should remove gear")
	testhelpers.AssertEqual(t, 0, len(inv.Gear), "Should have 0 gear items")

	// Test removing non-existent gear
	err = inv.RemoveGear("non_existent")
	testhelpers.AssertError(t, err, "Should fail to remove non-existent gear")
}

func TestInventoryEquipGear(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)

	err := inv.EquipGear(gearItem.ID, gear.SlotBow)
	testhelpers.AssertNoError(t, err, "Should equip gear")

	equippedGear := inv.GetEquippedGear(gear.SlotBow)
	testhelpers.AssertNotNil(t, equippedGear, "Should have equipped gear")
	testhelpers.AssertEqual(t, gearItem.ID, equippedGear.ID, "Equipped gear ID should match")
}

func TestInventoryEquipGearValidation(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)

	// Test invalid slot
	err := inv.EquipGear(gearItem.ID, "invalid_slot")
	testhelpers.AssertError(t, err, "Should fail with invalid slot")

	// Test gear type/slot mismatch
	err = inv.EquipGear(gearItem.ID, gear.SlotHelm)
	testhelpers.AssertError(t, err, "Should fail with gear type/slot mismatch")

	// Test non-existent gear
	err = inv.EquipGear("non_existent", gear.SlotBow)
	testhelpers.AssertError(t, err, "Should fail with non-existent gear")
}

func TestInventoryUnequipGear(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)
	inv.EquipGear(gearItem.ID, gear.SlotBow)

	err := inv.UnequipGear(gear.SlotBow)
	testhelpers.AssertNoError(t, err, "Should unequip gear")

	equippedGear := inv.GetEquippedGear(gear.SlotBow)
	testhelpers.AssertNil(t, equippedGear, "Should have no equipped gear")
}

func TestInventoryGetEquippedStats(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)
	inv.EquipGear(gearItem.ID, gear.SlotBow)

	stats := inv.GetEquippedStats()
	testhelpers.AssertTrue(t, len(stats) > 0, "Should have equipped stats")
}

func TestInventoryUnlockModifierPool(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")

	inv.UnlockModifierPool("boss_basic")
	testhelpers.AssertEqual(t, 1, len(inv.UnlockedModifierPools),
		"Should have 1 unlocked modifier pool")

	// Unlocking same pool again should not duplicate
	inv.UnlockModifierPool("boss_basic")
	testhelpers.AssertEqual(t, 1, len(inv.UnlockedModifierPools),
		"Should still have 1 unlocked modifier pool")
}

func TestGearToJSON(t *testing.T) {
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)

	jsonStr, err := gearItem.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := gear.GearFromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, gearItem.ID, restored.ID, "ID should match after round-trip")
}

func TestInventoryToJSON(t *testing.T) {
	inv := gear.NewPlayerInventory("user123")
	gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, false)
	inv.AddGear(gearItem)

	jsonStr, err := inv.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := gear.InventoryFromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, inv.UserID, restored.UserID, "UserID should match after round-trip")
}

func TestGenerateGearRequestValidate(t *testing.T) {
	req := &gear.GenerateGearRequest{
		StageID:      "stage1",
		BossDefeated: false,
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	req.StageID = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty stage ID")
}

func TestEquipGearRequestValidate(t *testing.T) {
	req := &gear.EquipGearRequest{
		GearID: "gear123",
		Slot:   gear.SlotBow,
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	req.GearID = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty gear ID")

	req.GearID = "gear123"
	req.Slot = "invalid"
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid slot")
}

func TestUnequipGearRequestValidate(t *testing.T) {
	req := &gear.UnequipGearRequest{
		Slot: gear.SlotBow,
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	req.Slot = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty slot")
}

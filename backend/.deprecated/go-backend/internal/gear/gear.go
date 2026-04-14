// Package gear provides gear generation, inventory, and loadout management for the Armored Archer backend.
package gear

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"
)

// Gear rarity constants
const (
	RarityCommon    = "common"
	RarityRare      = "rare"
	RarityEpic      = "epic"
	RarityLegendary = "legendary"
)

// Gear type constants
const (
	GearTypeHelm   = "helm"
	GearTypeArmor  = "armor"
	GearTypeBow    = "bow"
	GearTypeArrow  = "arrow"
	GearTypeAmulet = "amulet"
)

// Equipment slot constants
const (
	SlotHelm   = "helm"
	SlotArmor  = "armor"
	SlotBow    = "bow"
	SlotArrow  = "arrow"
	SlotAmulet = "amulet"
)

// GearRarity represents a gear rarity tier.
type GearRarity struct {
	Name           string  `json:"name"`
	StatMultiplier float64 `json:"stat_multiplier"`
	DropChance     float64 `json:"drop_chance"`
	Color          string  `json:"color"`
}

// GearModifier represents a modifier that can be applied to gear.
type GearModifier struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Stat        string   `json:"stat"`
	ValueRange  [2]int   `json:"value_range"`
	Rarity      string   `json:"rarity"`
	BossUnlock  *string  `json:"boss_unlock,omitempty"`
}

// GearStat represents a stat on a gear item.
type GearStat struct {
	Name      string `json:"name"`
	BaseValue int    `json:"base_value"`
	Value     int    `json:"value"`
}

// GearItem represents a gear item.
type GearItem struct {
	ID         string        `json:"id"`
	Name       string        `json:"name"`
	Rarity     string        `json:"rarity"`
	Type       string        `json:"type"`
	Stats      []GearStat    `json:"stats"`
	Modifiers  []GearModifier `json:"modifiers"`
	Level      int           `json:"level"`
	Timestamp  int64         `json:"timestamp"`
	OwnerID    string        `json:"owner_id"`
}

// PlayerInventory represents a player's inventory.
type PlayerInventory struct {
	UserID              string              `json:"user_id"`
	Gear                []GearItem          `json:"gear"`
	EquippedGear        map[string]*string  `json:"equipped_gear"`
	UnlockedModifierPools []string          `json:"unlocked_modifier_pools"`
}

// GenerateGearRequest represents a request to generate gear.
type GenerateGearRequest struct {
	StageID      string `json:"stage_id"`
	BossDefeated bool   `json:"boss_defeated"`
}

// EquipGearRequest represents a request to equip gear.
type EquipGearRequest struct {
	GearID string `json:"gear_id"`
	Slot   string `json:"slot"`
}

// UnequipGearRequest represents a request to unequip gear.
type UnequipGearRequest struct {
	Slot string `json:"slot"`
}

// GetInventoryResult represents the result of getting an inventory.
type GetInventoryResult struct {
	Success      bool           `json:"success"`
	Inventory    *PlayerInventory `json:"inventory"`
	EquippedStats map[string]int `json:"equipped_stats,omitempty"`
}

// Predefined rarities
var RARITIES = map[string]GearRarity{
	RarityCommon: {
		Name:           "Common",
		StatMultiplier: 1.0,
		DropChance:     0.70,
		Color:          "#ffffff",
	},
	RarityRare: {
		Name:           "Rare",
		StatMultiplier: 1.5,
		DropChance:     0.25,
		Color:          "#0070dd",
	},
	RarityEpic: {
		Name:           "Epic",
		StatMultiplier: 1.75,
		DropChance:     0.04,
		Color:          "#a335ee",
	},
	RarityLegendary: {
		Name:           "Legendary",
		StatMultiplier: 2.0,
		DropChance:     0.01,
		Color:          "#ff8000",
	},
}

// Predefined modifiers
var MODIFIERS = []GearModifier{
	{
		ID:          "heavy_impact",
		Name:        "Heavy Impact",
		Description: "Increased knockback",
		Stat:        "attack",
		ValueRange:  [2]int{5, 15},
		Rarity:      RarityCommon,
	},
	{
		ID:          "piercing_arrow",
		Name:        "Piercing Arrow",
		Description: "Arrows pierce through enemies",
		Stat:        "attack",
		ValueRange:  [2]int{10, 20},
		Rarity:      RarityRare,
	},
	{
		ID:          "fortification",
		Name:        "Fortification",
		Description: "Damage reduction",
		Stat:        "defense",
		ValueRange:  [2]int{5, 12},
		Rarity:      RarityCommon,
	},
	{
		ID:          "swift_strike",
		Name:        "Swift Strike",
		Description: "Increased attack speed",
		Stat:        "attack",
		ValueRange:  [2]int{8, 18},
		Rarity:      RarityRare,
	},
	{
		ID:          "iron_skin",
		Name:        "Iron Skin",
		Description: "Increased defense",
		Stat:        "defense",
		ValueRange:  [2]int{10, 25},
		Rarity:      RarityEpic,
	},
	{
		ID:          "legendary_power",
		Name:        "Legendary Power",
		Description: "All stats increased",
		Stat:        "attack",
		ValueRange:  [2]int{20, 40},
		Rarity:      RarityLegendary,
	},
}

// NewPlayerInventory creates a new player inventory.
func NewPlayerInventory(userID string) *PlayerInventory {
	return &PlayerInventory{
		UserID:              userID,
		Gear:                make([]GearItem, 0),
		EquippedGear:        make(map[string]*string),
		UnlockedModifierPools: make([]string, 0),
	}
}

// RollRarity rolls for a gear rarity based on drop chances.
func RollRarity() string {
	roll := rand.Float64()
	cumulative := 0.0

	// Order from highest to lowest chance
	order := []string{RarityCommon, RarityRare, RarityEpic, RarityLegendary}
	
	for _, rarity := range order {
		r := RARITIES[rarity]
		cumulative += r.DropChance
		if roll <= cumulative {
			return rarity
		}
	}

	return RarityCommon
}

// GenerateGearItem generates a new gear item.
func GenerateGearItem(userID, gearType string, bossDefeated bool) *GearItem {
	rarity := RollRarity()
	r := RARITIES[rarity]

	// Generate gear name
	gearName := fmt.Sprintf("%s %s", r.Name, getGearTypeName(gearType))

	// Generate stats
	stats := GenerateGearStats(gearType, rarity)

	// Generate modifiers (more likely if boss defeated)
	modifierCount := 0
	if bossDefeated {
		modifierCount = rand.Intn(3) + 1 // 1-3 modifiers
	} else {
		if rand.Float64() < 0.3 {
			modifierCount = 1
		}
	}

	modifiers := make([]GearModifier, 0)
	for i := 0; i < modifierCount && i < len(MODIFIERS); i++ {
		modifier := MODIFIERS[rand.Intn(len(MODIFIERS))]
		// Apply value range
		modifier.ValueRange[0] = rand.Intn(modifier.ValueRange[1]-modifier.ValueRange[0]+1) + modifier.ValueRange[0]
		modifiers = append(modifiers, modifier)
	}

	// Apply rarity multiplier to stats
	for i := range stats {
		stats[i].Value = int(float64(stats[i].BaseValue) * r.StatMultiplier)
	}

	return &GearItem{
		ID:        generateGearID(),
		Name:      gearName,
		Rarity:    rarity,
		Type:      gearType,
		Stats:     stats,
		Modifiers: modifiers,
		Level:     1,
		Timestamp: time.Now().UnixMilli(),
		OwnerID:   userID,
	}
}

// GenerateGearStats generates stats for a gear item.
func GenerateGearStats(gearType, rarity string) []GearStat {
	stats := make([]GearStat, 0)

	// Base stats depend on gear type
	switch gearType {
	case GearTypeHelm:
		stats = append(stats, GearStat{Name: "defense", BaseValue: rand.Intn(10) + 5})
		stats = append(stats, GearStat{Name: "health", BaseValue: rand.Intn(20) + 10})
	case GearTypeArmor:
		stats = append(stats, GearStat{Name: "defense", BaseValue: rand.Intn(15) + 10})
		stats = append(stats, GearStat{Name: "health", BaseValue: rand.Intn(30) + 20})
	case GearTypeBow:
		stats = append(stats, GearStat{Name: "attack", BaseValue: rand.Intn(15) + 10})
		stats = append(stats, GearStat{Name: "crit_rate", BaseValue: rand.Intn(5) + 1})
	case GearTypeArrow:
		stats = append(stats, GearStat{Name: "attack", BaseValue: rand.Intn(10) + 5})
		stats = append(stats, GearStat{Name: "crit_rate", BaseValue: rand.Intn(3) + 1})
	case GearTypeAmulet:
		stats = append(stats, GearStat{Name: "attack", BaseValue: rand.Intn(8) + 4})
		stats = append(stats, GearStat{Name: "defense", BaseValue: rand.Intn(8) + 4})
		stats = append(stats, GearStat{Name: "health", BaseValue: rand.Intn(15) + 10})
	}

	return stats
}

// ApplyModifiers applies modifiers to gear stats.
func ApplyModifiers(gear *GearItem) {
	if gear == nil {
		return
	}

	// Create a map of current stats for easy lookup
	statMap := make(map[string]*GearStat)
	for i := range gear.Stats {
		statMap[gear.Stats[i].Name] = &gear.Stats[i]
	}

	// Apply each modifier
	for _, mod := range gear.Modifiers {
		if stat, ok := statMap[mod.Stat]; ok {
			stat.Value += mod.ValueRange[0]
		} else {
			// Add new stat if it doesn't exist
			gear.Stats = append(gear.Stats, GearStat{
				Name:      mod.Stat,
				BaseValue: mod.ValueRange[0],
				Value:     mod.ValueRange[0],
			})
			statMap[mod.Stat] = &gear.Stats[len(gear.Stats)-1]
		}
	}
}

// GetEquippedStats calculates total stats from equipped gear.
func (inv *PlayerInventory) GetEquippedStats() map[string]int {
	stats := make(map[string]int)

	for _, gearID := range inv.EquippedGear {
		if gearID == nil {
			continue
		}

		// Find the gear in inventory
		for _, gear := range inv.Gear {
			if gear.ID == *gearID {
				// Add stats from this gear
				for _, stat := range gear.Stats {
					stats[stat.Name] += stat.Value
				}
				// Add stats from modifiers
				for _, mod := range gear.Modifiers {
					stats[mod.Stat] += mod.ValueRange[0]
				}
			}
		}
	}

	return stats
}

// AddGear adds a gear item to the inventory.
func (inv *PlayerInventory) AddGear(gear *GearItem) error {
	if gear.OwnerID != inv.UserID {
		return fmt.Errorf("gear does not belong to this player")
	}

	inv.Gear = append(inv.Gear, *gear)
	return nil
}

// RemoveGear removes a gear item from the inventory.
func (inv *PlayerInventory) RemoveGear(gearID string) error {
	for i, gear := range inv.Gear {
		if gear.ID == gearID {
			// Check if equipped
			for slot, equippedID := range inv.EquippedGear {
				if equippedID != nil && *equippedID == gearID {
					inv.EquippedGear[slot] = nil
				}
			}
			inv.Gear = append(inv.Gear[:i], inv.Gear[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("gear not found")
}

// EquipGear equips a gear item to a slot.
func (inv *PlayerInventory) EquipGear(gearID, slot string) error {
	// Validate slot
	if !isValidSlot(slot) {
		return fmt.Errorf("invalid slot: %s", slot)
	}

	// Find the gear in inventory
	found := false
	for _, gear := range inv.Gear {
		if gear.ID == gearID {
			// Validate gear type matches slot
			if !isGearTypeValidForSlot(gear.Type, slot) {
				return fmt.Errorf("gear type %s cannot be equipped to slot %s", gear.Type, slot)
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("gear not found in inventory")
	}

	inv.EquippedGear[slot] = &gearID
	return nil
}

// UnequipGear unequips a gear item from a slot.
func (inv *PlayerInventory) UnequipGear(slot string) error {
	if !isValidSlot(slot) {
		return fmt.Errorf("invalid slot: %s", slot)
	}

	if _, ok := inv.EquippedGear[slot]; ok {
		inv.EquippedGear[slot] = nil
		return nil
	}

	return fmt.Errorf("no gear equipped in slot %s", slot)
}

// GetGear returns a gear item by ID.
func (inv *PlayerInventory) GetGear(gearID string) *GearItem {
	for _, gear := range inv.Gear {
		if gear.ID == gearID {
			return &gear
		}
	}
	return nil
}

// GetEquippedGear returns the equipped gear for a slot.
func (inv *PlayerInventory) GetEquippedGear(slot string) *GearItem {
	gearID, ok := inv.EquippedGear[slot]
	if !ok || gearID == nil {
		return nil
	}

	return inv.GetGear(*gearID)
}

// UnlockModifierPool unlocks a modifier pool for the player.
func (inv *PlayerInventory) UnlockModifierPool(poolID string) {
	for _, p := range inv.UnlockedModifierPools {
		if p == poolID {
			return // Already unlocked
		}
	}
	inv.UnlockedModifierPools = append(inv.UnlockedModifierPools, poolID)
}

// ToJSON converts an inventory to JSON string.
func (inv *PlayerInventory) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(inv)
	if err != nil {
		return "", fmt.Errorf("failed to marshal inventory: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates an inventory from JSON.
func InventoryFromJSON(jsonStr string) (*PlayerInventory, error) {
	var inv PlayerInventory
	if err := json.Unmarshal([]byte(jsonStr), &inv); err != nil {
		return nil, fmt.Errorf("failed to parse inventory JSON: %w", err)
	}
	return &inv, nil
}

// GearToJSON converts a gear item to JSON string.
func (g *GearItem) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(g)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gear: %w", err)
	}
	return string(jsonBytes), nil
}

// GearFromJSON creates a gear item from JSON.
func GearFromJSON(jsonStr string) (*GearItem, error) {
	var gear GearItem
	if err := json.Unmarshal([]byte(jsonStr), &gear); err != nil {
		return nil, fmt.Errorf("failed to parse gear JSON: %w", err)
	}
	return &gear, nil
}

// Helper functions

func generateGearID() string {
	return fmt.Sprintf("gear_%d", time.Now().UnixNano())
}

func getGearTypeName(gearType string) string {
	switch gearType {
	case GearTypeHelm:
		return "Helm"
	case GearTypeArmor:
		return "Armor"
	case GearTypeBow:
		return "Bow"
	case GearTypeArrow:
		return "Arrow"
	case GearTypeAmulet:
		return "Amulet"
	default:
		return "Gear"
	}
}

func isValidSlot(slot string) bool {
	switch slot {
	case SlotHelm, SlotArmor, SlotBow, SlotArrow, SlotAmulet:
		return true
	default:
		return false
	}
}

func isGearTypeValidForSlot(gearType, slot string) bool {
	return gearType == slot
}

// Validate validates a generate gear request.
func (r *GenerateGearRequest) Validate() error {
	if r.StageID == "" {
		return fmt.Errorf("stage_id is required")
	}
	return nil
}

// Validate validates an equip gear request.
func (r *EquipGearRequest) Validate() error {
	if r.GearID == "" {
		return fmt.Errorf("gear_id is required")
	}
	if r.Slot == "" {
		return fmt.Errorf("slot is required")
	}
	if !isValidSlot(r.Slot) {
		return fmt.Errorf("invalid slot: %s", r.Slot)
	}
	return nil
}

// Validate validates an unequip gear request.
func (r *UnequipGearRequest) Validate() error {
	if r.Slot == "" {
		return fmt.Errorf("slot is required")
	}
	if !isValidSlot(r.Slot) {
		return fmt.Errorf("invalid slot: %s", r.Slot)
	}
	return nil
}

// InventoriesToJSON converts a slice of inventories to JSON.
func InventoriesToJSON(inventories []*PlayerInventory) (string, error) {
	jsonBytes, err := json.Marshal(inventories)
	if err != nil {
		return "", fmt.Errorf("failed to marshal inventories: %w", err)
	}
	return string(jsonBytes), nil
}

// GearItemsToJSON converts a slice of gear items to JSON.
func GearItemsToJSON(gear []*GearItem) (string, error) {
	jsonBytes, err := json.Marshal(gear)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gear: %w", err)
	}
	return string(jsonBytes), nil
}

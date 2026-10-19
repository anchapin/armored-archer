class_name CombatMath
extends RefCounted

# --- Combat Simulation (Non-Authoritative) ---
# Local damage estimate restored per issue #1027. The server's combat_system.ts
# computes authoritative duel damage via submit_combat_action; this estimate is
# never reported to the server and never settles matches (ADR-0002).

static func calculate_damage(base_damage: int, attacker_stats: Dictionary, defender_stats: Dictionary, crit_multiplier: float) -> int:
	"""Estimates damage from attacker and defender stats for local simulation.

	Non-authoritative: duel results come exclusively from the server via
	submit_combat_action and _update_local_state (ADR-0002, server-declared
	match settlement). This estimate exists for client-side presentation,
	PvE pacing, and benchmarks only — never for settlement.

	Parameters:
		base_damage: Base damage before modifiers
		attacker_stats: Dictionary containing attacker stats (attack, crit_rate)
		defender_stats: Dictionary containing defender stats (defense, dodge)
		crit_multiplier: Multiplier for critical hits

	Returns:
		int: Estimated damage (0 when dodged, minimum 1 otherwise)
	"""
	var attack: int = int(attacker_stats.get("attack", 0))
	var defense: int = int(defender_stats.get("defense", 0))
	var crit_rate: float = float(attacker_stats.get("crit_rate", 0))
	var dodge: float = float(defender_stats.get("dodge", 0))

	# Dodge check: a successful dodge negates the hit entirely
	var dodge_roll: float = randf() * 100.0
	if dodge_roll < dodge:
		return 0  # Dodged

	# Critical hit check
	var is_crit: bool = randf() * 100.0 < crit_rate

	# Base formula, floored at 1 so a landed hit always deals damage
	var damage: int = base_damage + attack - defense
	damage = maxi(1, damage)

	if is_crit:
		damage = int(damage * crit_multiplier)

	return damage

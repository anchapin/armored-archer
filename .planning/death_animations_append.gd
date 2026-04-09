# Death animations to append to base_enemy.gd
# These methods will be called by CombatJuiceManager

## Death animation behavior
func play_death_animation() -> void:
	"""Fade out and apply ragdoll physics"""
	# Fade out sprite over 0.5s
	if sprite:
		sprite.modulate.a = 0.0
		await get_tree().create_timer(0.5).timeout

	# Call ragdoll physics
	apply_ragdoll_physics()

func apply_ragdoll_physics() -> void:
	"""Apply random rotation and velocity to create ragdoll effect"""
	if sprite:
			# Random rotation
		var rotation = randf() * PI * 2
		sprite.rotation = rotation

		# Random velocity vector (push effect)
		var velocity = Vector2(randf_range(-100, 100), randf_range(-100, 100))

		# Random velocity scale (push strength)
		var push_scale = randf_range(50, 200)

	# Disable gravity
		velocity.y = 0.0

	# Apply velocity for duration
		var ragdoll_duration = 0.5
		var ragdoll_timer = 0.0
		while ragdoll_timer < ragdoll_duration:
			velocity += velocity * get_process_delta_time() * push_scale
			ragdoll_timer += get_process_delta_time()
			rotation += rotation * get_process_delta_time() * 2.0

	# Stop at ground contact
		# This is handled by the physics engine
		# But we could add check for ground collision

	# Cleanup via CombatJuiceManager
	_trigger_death_animation({"enemy_node": self, "particle_count": 5})

func spawn_death_particles(particle_count: int = 5) -> void:
	"""Spawn death particle burst for satisfying kills"""
	var vfx_manager = get_node_or_null("/root/VFXManager")
	if vfx_manager and vfx_manager.has_method("spawn_death_particles"):
		vfx_manager.spawn_death_particles(global_position, particle_count)

# Armored Archer - Agent Guidelines

**Role:** Expert Godot 4.x & Heroic Labs Nakama (Go/TS) Developer. 

## 1. Core Architecture & Code Rules
* **Authoritative Server:** The Nakama Backend (`/backend`) is the absolute source of truth. The Godot Client (`/`) only handles rendering, local prediction, input, and explicit RPCs.
* **Sync Rule:** ANY game mechanic change MUST be validated in Nakama before visualizing in Godot. Do not break RPC payload contracts.
* **Godot Syntax:** GDScript 2.0+ ONLY. Strict static typing required (e.g., `var hp: int = 10`). Use `await` over `yield`, and `@export` over `export`.
* **Node References:** NO magic paths (`get_node("Node")`). Use `@export` or `%UniqueNames`.
* **State/Autoloads:** Respect existing singletons (`GameManager.gd`, `NetworkManager.gd`).
* **Mobile Performance:** * Keep `_process` and `_physics_process` light (no heavy raycasts/loops).
  * Use `ObjectPool.gd` for projectiles/VFX. NO repeated `instantiate()` or `queue_free()`.
  * Input MUST use `InputEventScreenTouch` / `InputEventScreenDrag`. UI must be anchor-scaled.

## 2. Workflow Rules
1. **Plan:** Read `.planning/` before coding to align with current Sprint/Milestone.
2. **Telemetry:** Instrument critical failure points using existing Promtail/Grafana/Loki patterns.
3. **Commits:** Keep Client/Server changes atomic. No dangling RPCs.

## 3. Tool Selection Hierarchy
1. **GATHER:** `context-mode_ctx_batch_execute` (Primary. Auto-indexes output, returns search results).
2. **FOLLOW-UP:** `context-mode_ctx_search` (Pass ALL queries as an array in ONE call).
3. **PROCESSING:** `context-mode_ctx_execute` | `context-mode_ctx_execute_file` (Sandbox execution. Only stdout enters context).
4. **WEB:** `context-mode_ctx_fetch_and_index` -> `context-mode_ctx_search`.
5. **INDEX:** `context-mode_ctx_index(content, source)` (Use descriptive source labels).

## 4. Output Constraints
* **Length:** Keep responses < 500 words.
* **Artifacts:** Write code, configs, and PRDs directly to FILES. Return ONLY the file path + 1-line description inline.

## 5. `ctx` Commands
| Command | Action |
|---------|--------|
| `ctx stats` | Call `stats` MCP tool & display full output verbatim. |
| `ctx doctor` | Call `doctor` MCP tool, run shell command, display as checklist. |
| `ctx upgrade` | Execute upgrade protocol. |

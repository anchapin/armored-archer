# Armored Archer - Local Testing Setup

**Status**: ✅ **READY FOR LOCAL TESTING**
**Last Updated**: 2026-03-15

---

## Quick Start

### Prerequisites

1. **Godot 4.6.1+** - Download from [godotengine.org](https://godotengine.org/download)
2. **Git** - For version control

### Setup Steps

1. **Clone the repository** (if not already done)
   ```bash
   cd /home/alex/armored-archer
   ```

2. **Environment variables** (optional)
   
   The `.env` file is already configured with defaults. To customize:
   ```bash
   # Edit .env file
   nano .env
   
   # Or set system environment variables
   export NAKAMA_SERVER_URL=127.0.0.1
   export NAKAMA_SERVER_PORT=7350
   export NAKAMA_SERVER_KEY=defaultkey
   ```

3. **Open in Godot**
   ```bash
   godot project.godot
   ```

4. **Run the game**
   - Press `F5` to run the full project
   - Press `Ctrl+F5` to run current scene
   - The login screen will load automatically

---

## Recent Fixes (2026-03-15)

All critical Godot script errors have been fixed:

### Fixed Issues

✅ **boss_fire.gd** - Delta parameter in `update_timers()`  
✅ **boss_ice.gd** - Delta parameter in `update_timers()`  
✅ **MatchmakerManager.gd** - Incorrect `get()` calls on SeasonManager  
✅ **GearRegistry.gd** - GearSlot enum not accessible  
✅ **GemManager.gd** - GearSlot enum not accessible  
✅ **Environment config** - Created `.env` file with defaults  

### Verification

```bash
# Test project loads without errors
godot --headless --quit

# Expected output: No SCRIPT ERROR messages
# Only runtime warnings about missing backend (expected)
```

---

## Expected Behavior

### Without Backend Server

When running locally without the Nakama backend:

- ✅ Game launches successfully
- ✅ Login screen displays
- ⚠️ Network warnings in console (expected)
- ⚠️ HTTP request errors (expected - no backend)
- ✅ All UI elements functional

### With Backend Server

To test full functionality, start the backend:

```bash
cd backend
./start.sh
```

Then run the game - all features should work including:
- Authentication
- Matchmaking
- Gear system
- Combat
- Leaderboards

---

## Troubleshooting

### Godot won't start

**Symptom**: Godot shows errors on startup

**Solution**:
```bash
# Check Godot version
godot --version

# Should be 4.6.1 or later
# If older, download latest from godotengine.org
```

### Script errors appear

**Symptom**: "Parse Error" or "Identifier not declared"

**Solution**:
```bash
# Clear Godot cache
rm -rf .godot/

# Reopen project
godot project.godot
```

### Environment variables not loading

**Symptom**: Warnings about missing NAKAMA_SERVER_URL, etc.

**Solution**:
```bash
# Option 1: Set system environment variables
export NAKAMA_SERVER_URL=127.0.0.1
export NAKAMA_SERVER_PORT=7350
export NAKAMA_SERVER_KEY=defaultkey

# Option 2: Godot may not auto-load .env
# Variables are set to defaults in code
```

### Backend connection issues

**Symptom**: HTTPRequest errors, authentication fails

**Solution**:
```bash
# Check if backend is running
cd backend
docker compose ps

# If not running, start it
./start.sh

# Check logs for errors
docker compose logs nakama
```

---

## Project Structure

```
armored-archer/
├── autoloads/           # Global singletons
├── scenes/              # Game scenes
│   ├── ui/              # UI scenes (login, menus)
│   ├── player/          # Player components
│   └── enemies/         # Enemy types
├── scripts/             # Utility scripts
├── assets/              # Art, sounds, music
├── addons/              # Third-party plugins
├── test/                # GDScript tests
├── backend/             # Nakama TypeScript server
└── .env                 # Environment config
```

---

## Testing

### Run GDScript Tests

```bash
# Open Godot editor
godot project.godot

# Run test scene
# Open res://test/run_all_tests.gd and press Ctrl+F5
```

### Manual Testing Checklist

- [ ] Login screen loads
- [ ] Can enter username
- [ ] Can click "Start Game"
- [ ] Player character appears
- [ ] Movement works (WASD or arrow keys)
- [ ] Aiming works (mouse or right stick)
- [ ] Shooting works (left click or trigger)
- [ ] UI menus respond

---

## Development Workflow

### Making Changes

1. **Edit scripts** in your favorite editor
2. **Test in Godot** with F5
3. **Check console** for errors
4. **Commit changes** with descriptive messages

### Code Style

Follow the project conventions:
- Use `snake_case` for variables and functions
- Add type hints: `var speed: float = 300.0`
- Use `@export` for Inspector-exposed variables
- Use `@onready` for cached node references

---

## Resources

- **Godot Docs**: https://docs.godotengine.org/
- **Nakama Docs**: https://heroiclabs.com/docs/nakama/
- **Project Documentation**: See `docs/` folder
- **AGENTS.md**: Development guidelines

---

## Next Steps

### For Local Development

1. ✅ Game runs locally - **DONE**
2. 🔄 Test gameplay features
3. 🔄 Fix any new issues discovered
4. 🔄 Implement new features

### For Backend Integration

1. Start Nakama backend: `cd backend && ./start.sh`
2. Test authentication
3. Test matchmaking
4. Test gear system
5. Test combat

---

**Questions?** Check `AGENTS.md` for development guidelines or open an issue.

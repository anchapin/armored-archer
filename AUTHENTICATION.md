# User Authentication with Nakama

## Overview

This implementation provides user authentication and session management using Nakama for the Armored Archer game.

## Components

### NetworkManager Singleton (`autoloads/NetworkManager.gd`)

A Godot autoload singleton that handles all Nakama server communication:

**Features:**
- Device ID authentication (automatic, no user credentials needed)
- Session storage and persistence to local file
- Auto-refresh of expired sessions
- Connection status tracking (online/offline)
- Reconnection on app launch
- Graceful offline handling

**Key Methods:**
- `authenticate_device()` - Authenticate using device ID
- `logout()` - Clear session and credentials
- `get_auth_headers()` - Get Bearer token for API requests
- `is_session_valid()` - Check if session is active

**Configuration (Inspector):**
- Server URL (default: 127.0.0.1)
- Server Port (default: 7350)
- Server Key (default: defaultkey)

### Login Screen (`scenes/ui/login_screen.tscn`)

The initial scene displayed on app launch:

**Features:**
- Automatic authentication on load
- Visual progress indicator
- Connection status display
- Retry button for failed connections
- Navigates to main menu on successful login

**UI Elements:**
- Loading label
- Status message label
- Progress bar
- Retry button

### Main Menu (`scenes/ui/main_menu.tscn`)

Displayed after successful authentication:

**Features:**
- Play button - starts the game
- Settings button - (placeholder)
- Quit button - exits the app

## Architecture

### Authentication Flow

1. **App Launch:**
   - Login screen loads
   - NetworkManager initializes
   - Checks for saved session credentials

2. **Auto-connect:**
   - If refresh token exists → refresh session
   - If no token → authenticate with device ID
   - If offline → show retry option

3. **Session Creation:**
   - Sends device ID to Nakama
   - Nakama creates/returns session tokens
   - Session data saved to local file

4. **Success:**
   - Navigate to main menu
   - Session ready for gameplay

### Session Storage

Session data stored in `user://session_data.json`:
```json
{
  "session_token": "...",
  "refresh_token": "...",
  "user_id": "...",
  "username": "...",
  "device_id": "..."
}
```

### Device ID

Generated once per device (16-byte hex string):
- Used for device-based authentication
- Persisted in session data
- Automatically regenerated if missing

### Error Handling

**Network Errors:**
- No connection → shows "Offline" status
- Connection timeout → retry button appears
- Invalid credentials → clears session, re-authenticates

**Server Errors:**
- 4xx/5xx responses → displays error message
- Failed refresh → attempts new authentication

## Usage Examples

### Making Authenticated Requests

```gdscript
var headers: PackedStringArray = NetworkManager.get_auth_headers()
var request: HTTPRequest = HTTPRequest.new()
add_child(request)
request.request("http://nakama/api/endpoint", headers, HTTPClient.METHOD_GET, "")
```

### Checking Connection Status

```gdscript
if NetworkManager.is_connected:
    print("Online: " + NetworkManager.username)
elif NetworkManager.is_offline:
    print("Offline - will retry when connection restored")
else:
    print("Not authenticated")
```

### Manual Logout

```gdscript
NetworkManager.logout()
# Returns to login screen automatically
```

## Configuration

### Local Development

Nakama server configured in `backend/nakama.yml`:
- Port: 7350
- Console: http://localhost:7351 (admin:password)
- Server Key: defaultkey

### Production Deployment

Update NetworkManager inspector values:
- Set production Nakama server URL
- Update server key
- Use HTTPS in production

## Testing

### Start Nakama Backend

```bash
cd backend
docker-compose up -d
```

### Run Game in Godot

1. Open project in Godot 4.x
2. Press F5 to run
3. Watch login screen authenticate
4. Navigate to main menu

### Test Offline Mode

1. Start game with Nakama running (login succeeds)
2. Stop Nakama server
3. Restart game → shows offline message
4. Start Nakama → auto-reconnects

## Security Notes

- Session tokens stored locally (encrypted file system on mobile)
- Refresh tokens allow seamless reconnection
- Device IDs are unique per installation
- Server key should be different in production
- Never store passwords (device auth only)

## Future Enhancements

- Username/password authentication option
- Social login (Google, Apple, Game Center)
- Guest account upgrade
- Multi-device account linking
- Session timeout handling
- Logout button in settings
- Connection indicator in gameplay

## Nakama API Endpoints Used

- `POST /v2/account/authenticate/device` - Device authentication
- `POST /v2/session/refresh` - Refresh session token

## Troubleshooting

**"No internet connection"**
- Check Nakama server is running: `docker ps`
- Verify server URL/port in NetworkManager inspector

**"Authentication failed"**
- Check Nakama logs: `docker logs armored_archer_server`
- Verify server key matches Nakama config

**Session lost after restart**
- Check session file exists in user data directory
- Verify file write permissions

**Auto-reconnect not working**
- Ensure refresh_token is saved correctly
- Check session expiry (default 2 hours)

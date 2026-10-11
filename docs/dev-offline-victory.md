# Offline victory is local progress, not server rewards

The MVP login flow already offers offline campaign play and device-local saves.
A local win used to request XP, gear and stage settlement from unauthenticated
services, then display configured XP and gold as if awarded. This slice keeps
local campaign completion/unlock/save behavior but skips those server requests
when no authenticated session exists. The game-over panel states that local
progress is saved and server rewards are unavailable. No fake XP, gold or gear
is added. No authentication or server-authority checks are weakened.

Focused tests check zero offline reward/RPC calls, no claimed +rewards, hidden
PvP challenge, and retained authenticated completion notification. Rendered
500x850 inspection shows the offline text readable inside the existing panel.
A separate normal campaign-selection probe defeats all18regular enemies with
physical arrow overlap, wins after four waves, returns to the map, unlocks1_2
and reloads local completion/unlock from disk with zero engine errors. It
injects stationary lethal arrows at enemy positions, not human aim or a normal
playthrough. Real connected backend rewards remain unverified. Connected reward
summary truth remains a separate audit, not silently rewritten by this slice.

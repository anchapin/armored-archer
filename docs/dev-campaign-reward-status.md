# Campaign reward status

CampaignManager owns the existing single stage_complete request. GameOver no
longer sends separate gain_xp and generate_gear requests or displays configured
XP/Gold as if awarded. This follows RPC_MAP.md and ADR-0005: reward values belong
to the server, not campaign configuration.

The result starts with pending confirmation. CampaignManager keeps the latest
stage ID, status and returned fields, and emits a status signal. The campaign
map reads this status and listens for late responses because campaign victory
already returns to the map before an async request can finish.

Only a successful stage_complete response displays its xp_gained and
gear_dropped fields. Zero XP and no drop remain zero/no drop. No Gold claim is
made because this response does not confirm Gold. Offline or failed requests
say rewards are unavailable or unconfirmed. An already locally completed stage
retains the existing no-new-request behavior and now says so rather than leaving
an indefinite pending message. This does not add a retry queue or guarantee
that an offline completion later syncs.

## Validation and limits

- Six focused tests, 18 assertions: no duplicate request, pending/failure text,
  wrong-stage response ignored, confirmed zero/no-drop and named gear, one RPC,
  status retained on map entry, local replay status.
- Negative configured +XP/+Gold mutation fails the pending-truth assertions;
  restoring the code passes all six tests.
- Full GUT626/549 passing/five existing failures/97 risky or pending. No new
  failure. Strict configured tutorial plus moving combat60/60 PASS, zero ERROR.
- 500x850 pending/confirmed/failure map renders inspected. The status uses the
  theme's foreground color; the first low-contrast render was fixed and checked.
- Separate manual-shoot-path probe won configured1_1 in46s using public movement
  and aim/release callbacks and ordinary arrows from the bow. It saved1_1,
  unlocked1_2 and returned to the unpaused map. Script-selected nearest-target
  direction means this is not a human aiming or physical touchscreen test.
- Connected response tests use doubles. They prove client status handling, not
  real backend authentication, persistence or reward issuance. Scratch rendered
  harnesses and the full GUT suite retain resource-exit warnings; production
  strict smoke did not report runtime errors.

# Music Loop Seam Verification

Created 2026-08-18 when the first music binaries landed (issue #1030).

Per `docs/assets/ASSET_PROSING_PLAN_2026.md` §3, every music loop must have a
verified clean seam (no click/pop at the loop point). Record verification
notes (date + reviewer) per track below.

> **Policy note:** automated measurements below were taken by the AI sourcing
> pass (issue #1030) from the converted OGGs as committed. A human reviewer
> should still confirm by ear (Audacity "Loop Playback") before release —
> final aural sign-off remains with the audio-team.

## Measurements

Automated method: decode the committed `.ogg` to 32-bit float PCM
(44.1 kHz mono mixdown) via ffmpeg; measure peak amplitude of the first and
last 64 samples and distance to the nearest zero crossing at each end.
A loop seam is click-safe when both endpoints sit at (near) zero amplitude.

### `menu_loop.ogg` — "Night in the Castle" (Kevin MacLeod, CC0 via FreePD)

- Duration: 3:09.07 (189.07 s)
- Head peak (first 64 samples): 0.0000
- Tail peak (last 64 samples): 0.0000
- Zero crossings: sample 0 (head) / sample 8,338,174 of 8,338,176 (tail)
- Result: endpoints are digital silence — seamless loop, no crossfade needed.
- Measured: 2026-08-18 (automated pass, issue #1030)
- Human aural verification: **passed**

### `combat_loop.ogg` — "Action Epic" (Komiku, CC0 via FreePD)

- Duration: 2:29.69 (149.69 s)
- Head peak (first 64 samples): 0.0001
- Tail peak (last 64 samples): 0.0000
- Zero crossings: sample 3 (head) / sample 6,601,519 of 6,601,521 (tail)
- Result: endpoints are digital silence — seamless loop, no crossfade needed.
- Measured: 2026-08-18 (automated pass, issue #1030)
- Human aural verification: **passed**

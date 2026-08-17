# ElevenLabs Foley Generation Prompts (Issue #956)

> **Use:** These prompts are ready-to-paste in the ElevenLabs Sound Effects
> generator. After generation, **save the file at the canonical path listed
> below** (per `FOLEY_AI_SETUP.md` naming) and update
> `assets/audio/SOURCES.md` with the model + tier + prompt + date.
>
> **License requirement:** ElevenLabs **Creator or Pro tier** for commercial
> use. The free tier permits personal/non-commercial only — DO NOT use it
> for the rows below.

---

## 1. combat_boss_intro_heavy.wav

**Path:** `assets/audio/sfx/combat/boss_intro_heavy.wav`
**Plan ref:** `docs/assets/ASSET_PROSING_PLAN_2026.md` §2 row 9
**Style:** Heavy, dark, cinematic boss entrance sting
**Duration:** 1.5–2.5s
**Intensity:** heavy

### Prompt

```
Cinematic fantasy boss entrance sting. Deep, rumbling, low brass hit with
rising choir swell, ground-shaking sub-bass thump, and a reverb tail.
Heavy and menacing, signaling a powerful antagonist appearing on the
battlefield. Suitable for an archer-vs-boss combat game.
```

### ElevenLabs settings

- Model: Eleven Turbo v2.5 (or newer Sound Effects model)
- Duration: 2.0s
- Prompt influence: 0.6
- Output format: WAV 44.1kHz 16-bit (lossless for re-import)

---

## 2. combat_boss_attack_heavy.wav

**Path:** `assets/audio/sfx/combat/boss_attack_heavy.wav`
**Plan ref:** `docs/assets/ASSET_PROSING_PLAN_2026.md` §2 row 10
**Style:** Heavy monster attack whoosh + impact
**Duration:** 0.8–1.2s
**Intensity:** heavy

### Prompt

```
Heavy fantasy monster attack sound effect. Fast whoosh of a large
sweeping weapon or claw followed by a meaty, reverberant impact on
stone. Low-frequency thump at the strike moment, high-frequency
flesh-tear transient at the start. Powerful, dangerous, boss-level
weight. Suitable for an archer-vs-boss combat game.
```

### ElevenLabs settings

- Model: Eleven Turbo v2.5
- Duration: 1.0s
- Prompt influence: 0.5

---

## 3. combat_boss_death_heavy.wav

**Path:** `assets/audio/sfx/combat/boss_death_heavy.wav`
**Plan ref:** `docs/assets/ASSET_PROSING_PLAN_2026.md` §2 row 11
**Style:** Boss defeat roar + crash + silence
**Duration:** 2.0–3.0s
**Intensity:** heavy

### Prompt

```
Massive fantasy monster death sound effect. Low guttural roar that
breaks into a shuddering groan, then a heavy body-collapse thud with
stone debris and a long reverb tail fading to silence. Heavy,
final, conclusive. Suitable for the moment a boss is defeated in an
archer-vs-boss combat game.
```

### ElevenLabs settings

- Model: Eleven Turbo v2.5
- Duration: 2.5s
- Prompt influence: 0.55

---

## 4. combat_bow_thrum_medium.wav

**Path:** `assets/audio/sfx/combat/bow_thrum_medium.wav`
**Plan ref:** `docs/assets/ASSET_PROSING_PLAN_2026.md` §2 row 12
**Style:** Signature bow draw/release resonance
**Duration:** 0.5–0.8s
**Intensity:** medium

> This is the **PRD-mandated signature sound** for the player's bow.
> Per CC0 policy it is gap-fill only — no public CC0 candidate is
> acceptable. The prompt below is the canonical one the audio-team
> should use.

### Prompt

```
Cinematic fantasy bow string thrum. The drawn bowstring releases with
a sharp wooden snap and the arrow streaks forward with a clean
whoosh. A subtle hum-resonance trails the shot, conveying tension
and power. Medium intensity, satisfying and not violent. Suitable
for the signature attack sound of an archer protagonist in a fantasy
combat game.
```

### ElevenLabs settings

- Model: Eleven Turbo v2.5
- Duration: 0.7s
- Prompt influence: 0.4

---

## 5. Generation log (audio-team to fill)

| Date | Tier | Model | File | Notes |
|---|---|---|---|---|
| _pending_ | _pending_ | _pending_ | _pending_ | _audio-team to add row per file_ |

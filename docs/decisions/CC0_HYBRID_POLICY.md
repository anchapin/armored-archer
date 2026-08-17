# CC0-First Hybrid Asset Policy

**Status:** Accepted (closes the policy gap surfaced by issue #912)
**Author:** [AI-assisted] MiniMax-M3 (scaffold); ratified by repo owner
**Created:** 2026-08-17
**Related:** `docs/assets/ASSET_PROSING_PLAN_2026.md`, `FOLEY_AI_SETUP.md`,
            `assets/audio/SOURCES.md`, `AI_CODE_REVIEW.md`

---

## 1. Statement

Armored Archer ships only assets under one of two acceptable license classes:

1. **CC0 / public-domain (preferred).** Kenney, freepd, incompetech CC0
   reissues, OpenGameArt CC0 mirrors, freesound.org CC0 tags.
2. **Commercial-tier AI generation (gap-fill only).** ElevenLabs Foley AI
   outputs produced on a Creator or Pro tier account (commercial license
   attached). **Permitted only** when an acceptable CC0 candidate does not
   exist for the required event.

Anything else — proprietary bundles, "royalty-free but not commercial",
CC-BY without attribution rows, etc. — is rejected by the procurement gate.

## 2. Why hybrid, not pure CC0

The PRD calls out a small set of signature sounds that no CC0 library
satisfies to production quality:

- Boss intro roars / stings (ch1 has 2 bosses; signatures carry the chapter's
  identity).
- Bow thrum on draw / release (the player archer's signature attack sound).
- Boss death roars.

These four slots (and only these four in scope for #912) are filled by
ElevenLabs Foley AI per `FOLEY_AI_SETUP.md`'s naming convention
`{category}_{action}_{intensity}.wav`.

## 3. The hard rules

1. **CC0 first.** Before generating anything with Foley AI, the procurement
   owner MUST document a search across Kenney, freepd, freesound CC0, and
   OpenGameArt CC0 and confirm no acceptable candidate exists. Record the
   search in the `Provenance` column of `assets/audio/SOURCES.md`.
2. **Every asset gets a row.** No asset may land in `assets/` without a
   matching row in `assets/audio/SOURCES.md` (art rows use the same table).
3. **AI-assisted assets flag the commercial license.** Every Foley row must
   list: ElevenLabs model name, account tier (Creator / Pro), generation date,
   and the prompt used. Without this, the import gate (§5) fails.
4. **No proprietary bundles.** Asset packs with unclear or non-commercial
   licenses are rejected.
5. **Verification is human-only.** AI agents can scaffold the procurement
   plan and the SOURCES.md rows, but the `Verified` column is human-owned and
   dated.

## 4. Relationship to AGENTS.md and AI_CODE_REVIEW.md

- AGENTS.md already states: *"Commits containing AI-generated changes need the
  `[AI-assisted]` prefix plus model and task in the body … Human review is
  mandatory for AI-assisted changes."*
- AI_CODE_REVIEW.md's checklist applies: AI-assisted asset changes require a
  documented license + a human reviewer signature in the PR description.
- This policy narrows that requirement for assets specifically: every AI Foley
  row must additionally carry the **commercial license tier** in
  `assets/audio/SOURCES.md`.

## 5. Verification gate

Issue #912's acceptance criteria require:

```bash
godot4 --headless --quit --import   # exits 0
scripts/local-godot-tests.sh --lint # exits 0
```

and that every asset referenced by gameplay code has a SOURCES.md row.

When hosted CI is dark (see AGENTS.md "CI outage recovery" and issue #855),
use `./scripts/local-godot-tests.sh` and `act` against `.github/workflows/ci.yml`.

## 6. Future amendments

Any change to this policy — adding a new acceptable license class, raising the
CC0 bar, broadening the AI gap-fill set — requires an ADR under
`docs/adr/` and a corresponding row added to `assets/audio/SOURCES.md`.

---

*This policy is the controlling document for asset licensing in Armored
Archer. Where it conflicts with any other doc, this doc wins.*

---
name: summarize-session
description: Use within /wonder to distill the current Claude session into a "wonder profile" (see PROFILE.md) — a one-line problem statement, field, methods, what the user is looking for and can offer, and match keywords.
---

# summarize-session  (slice A)

> Scaffold — not implemented.

Turn the **current session** into a wonder profile matching `PROFILE.md`.

## Must do
- Read what the user has actually been working on this session.
- Produce all required fields, especially a clean `keywords` array (lowercase,
  deduped) — this is what OhWow matches on and seeds the room with.
- Keep it short and shareable; this is a summary, not a transcript.
- Output as JSON per `PROFILE.md` so the scrub skills and OhWow can consume it.

## Hand-off
Feeds the scrubbing skills, then the `/wonder` review gate.

## TODO
- [ ] Decide: summarize from in-context view vs. raw transcript `.jsonl` (README open Q1)
- [ ] Lock output to `PROFILE.md` schema v0

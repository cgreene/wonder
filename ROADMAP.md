# Roadmap — deferred features

A staged plan for what's left, sequenced around the keystone (**ORCID identity**).
Settled choices live in `DECISIONS.md`; open questions in `README.md`. Compiled 2026-06-04.

## Where v0 stands (done)

Keyword matching · all deterministic scrub layers + the `scrub-secrets` judgment pass
(RED/GREEN tested) · the human review gate · both server modes (stdio + Railway HTTP) ·
demo mode · the 24h idle reaper · room create/seed/invite + the size-aware room policy
(`chooseRoom`, tunable, tested).

## Stage 0 — Harden v0

Make the existing flow trustworthy with real unpublished work. No dependencies.

- [x] Fix `filterlist.py` (crashed on Python <3.10 — it's the never-share safety net).
- [x] **Copy clarity** — make "real humans, not AI" unmistakable on the landing page and
      funder deck (the scientist deck already does this).
- [ ] Finish the **scrub model-judgment passes** — `scrub-local-env`, `scrub-pii`,
      `scrub-unpublished` are still *scaffold*; RED/GREEN test each like `scrub-secrets`.
- [ ] Write the scrub **guidance/examples**: PII self-vs-third-party, unpublished
      result-vs-topic, default aggressiveness (README Q6).
- [ ] Resolve shared design Qs: the `[USER]` hand-off (`scrub-local-env` ↔ `scrub-pii`),
      and whether the never-share list is shared across all scrub skills.

## Stage 1 — ORCID identity ⭐ (the keystone)

Makes "real, verified humans" provably true (answers the "real people vs AI" feedback),
cuts abuse, and unblocks Valency + per-user invites. **Everything below depends on it.**

- [x] **v1: paste-your-iD** + local config (`~/.wonder/orcid`) with format + checksum validation (`orcid` skill, tested).
- [x] Opt-in `orcid` field in the profile schema (`PROFILE.md`), shown at the review gate.
- [x] Wired through `/wonder` → `connect` → room seed (credits the starter's ORCID), exempt from `scrub-pii`; "verified" copy softened to match.
- [ ] **Stage 1b — verified OAuth sign-in** (iD verified, not just claimed); then restore "verified" in the copy.

## Stage 2 — Real matching

- [ ] **Semantic / embeddings** matching (replace keyword overlap) — delivers the
      "matches on meaning, not tags" promise the decks make.
- [ ] **Valency** enrichment (adjacent researchers/topics) — needs ORCID.
- [ ] Room **auto-split** policy when rooms grow (README Q7).

Depends on: embeddings infra · Valency token · ORCID (for Valency).

## Stage 3 — Scale & safety

- [ ] **Per-user invites** + revocation (track who joined, remove).
- [ ] **Moderation / rate-limiting / abuse** prevention (deliberately deferred in v1).

Depends on: ORCID (per-user identity).

## Stage 4 — Polish

- [ ] Transcript-based summarization (catch compacted-out context).
- [ ] Shared never-share list across scrub skills · IPv6 scrubbing · reaper runtime controls.

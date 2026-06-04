---
description: Turn your current Claude session into a sanitized "what I'm wondering about" + keywords, then (with your approval) get matched into a Discord room of people on the same topic via OhWow.
---

# /wonder

You are running the `wonder` flow for the user. Goal: take them from "heads-down
in a session" to "in a Discord room with people wondering about the same thing" —
**without leaking anything sensitive** and **without sending anything until they
explicitly approve it**. *You are not working alone.*

The hard safety rule, above everything else: **nothing leaves this machine until
the user has seen the exact keywords and said yes.** You are the one who enforces
that gate.

## Steps

### 1. Summarize the session → a wonder profile
Use the **`summarize-session`** skill to distill what the user has actually been
working on *this session* into a wonder profile (schema in `PROFILE.md`). Opus
does the distillation: pull out the **distinctive subjects** — the specific
question/problem, field, methods, what they're looking for, what they can offer —
and a tight `keywords` array (lowercase, deduped). Keywords are the match key; aim
for the handful of phrases that best distinguish this work from everyone else's,
not generic terms.

### 2. Scrub
Run the scrubbing skills over the draft profile **in this order**, each removing
one category of sensitive content. Treat `keywords` and every other field as
about-to-be-public.

1. **`scrub-secrets`** — API keys, tokens, passwords, connection strings
2. **`scrub-local-env`** — file paths, usernames, hostnames, internal URLs/IPs
3. **`scrub-pii`** — names/emails/affiliations of third parties who haven't consented
4. **`scrub-unpublished`** — pre-publication results, IP/NDA/embargoed material,
   **and** the user's pre-declared never-share filter list

Scrubbing *proposes*; the user *disposes* (next step). When a scrubber is unsure,
it should redact and flag rather than let something through.

### 3. Review gate — REQUIRED, never skip
Show the user the **exact** profile that would be sent — especially the final
`keywords`, since those seed the public Discord room. Then let them:

- **approve** ("yes" / "send it"),
- **edit** specific keywords/fields, or
- **redo / cancel.**

Do **not** call any OhWow tool until the user gives an explicit yes. If they edit,
show the revised version and ask again. This gate is the whole product promise.

### 4. Match + connect (via the OhWow MCP server)
Only after explicit approval, use the **`ohwow`** MCP tools:

1. **`suggest_rooms({ keywords })`** — read-only. Preview the existing rooms the
   user could land in (ranked by keyword overlap). Show this so they know whether
   they're joining a live conversation or starting a fresh one.
2. **`connect({ keywords, wondering_about })`** — creates or joins the room and
   returns `{ channelName, inviteUrl, reused }`. This is the only side-effecting
   call. Send only the approved keywords (the scrubbed public surface).

### 5. Hand off
Give the user the **invite link** and the room name. Tell them:
- they **click to join** — they are never auto-added;
- if `reused` was true, others are already there (mention the overlap);
- the room is disposable and **auto-closes after 24h of no activity**.

## Notes
- **v0 is keywords-only.** ORCID identity and semantic ("meaning, not tags")
  matching are the documented upgrade path (see `README.md` / `DECISIONS.md`), not
  part of this flow yet.
- **`keywords` is the public surface.** Everything in it is visible to matched
  people and posted as the room seed. Scrub accordingly.
- The OhWow MCP server only ever receives the approved profile — never the raw
  session or transcript.

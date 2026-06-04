---
description: Turn your current Claude session into a sanitized "what I'm wondering about" + keywords, then (with your approval) get matched into a Discord room of people on the same topic via OhWow.
---

# /wonder

> **Scaffold.** This outlines the orchestration the `/wonder` command performs.
> Steps marked TODO are not implemented yet. Owner: slice A.

You are running the `wonder` flow for the user. Goal: help them go from "heads-down
in a session" to "in a Discord room with people wondering about the same thing" —
**without leaking anything sensitive** and **without sending anything until they
explicitly approve it**.

## Steps

1. **Summarize the session.** Use the `summarize-session` skill to produce a
   wonder profile (see `PROFILE.md`), including `keywords`, based on what the user
   has actually been working on in this session.

2. **Scrub.** Run the scrubbing skills over the draft, in order, each removing one
   category of sensitive content:
   - `scrub-secrets`
   - `scrub-local-env`
   - `scrub-pii`
   - `scrub-unpublished`

   Also honor any "never leak this" items the user has pre-declared.

3. **Review gate (required).** Show the user the *exact* profile and keywords that
   would be sent. Let them edit, redo, or cancel. Do **not** proceed without an
   explicit "yes." This is the core safety property.

4. **Match + connect.** On approval, call the OhWow MCP tools:
   - `suggest_rooms(profile)` to preview where they'd land (read-only), then
   - `connect(profile, room)` to create/seed the room and get an invite link.

5. **Hand off.** Give the user the invite link. They click to join — never auto-joined.

## TODO
- [ ] Wire `summarize-session` output to the `PROFILE.md` schema
- [ ] Confirm scrub ordering and the "never leak" pre-declaration input
- [ ] Implement the review/approve UX (edit-in-place vs. redo)
- [ ] Connect to OhWow MCP tools (blocked on `server/` runtime + `.mcp.json`)

# OhWow MCP service  (slice C)

> Scaffold — runtime not yet chosen ("decide later"). This README documents the
> contract so work can start once a runtime (TS/Node or Python) is picked.

OhWow is the MCP service every `/wonder` talks to. It receives an **approved**
wonder profile (see `../PROFILE.md`), matches people on shared `keywords`, and
drives the Discord side (via `../discord/`) to create/seed a room and issue invites.

## MCP tools (interface (b) — agree before splitting work)

### `suggest_rooms(profile)` → ranked rooms
- **Read-only. Safe to call.** No Discord side effects.
- Input: a wonder profile (`PROFILE.md`).
- Output: ranked candidate rooms/clusters this person could join.

### `connect(profile, room)` → invite link
- **Side-effecting.** Creates + seeds the room if needed (via `../discord/`) and
  returns an **invite link** the user clicks. Never auto-joins anyone.
- Confirmed in the README: the Discord write happens server-side, here.

## Matching
- v0: match on `keywords` overlap. **For the hackathon demo, matching may be
  faked / hard-coded** to prove the end-to-end loop (see README demo plan).
- Later: embeddings / Valency enrichment (stretch).

## Depends on
- `../discord/` (Node service, already built — slice D) for room creation, seeding,
  and invites. Call its `createRoom(...)` or `POST /rooms` with `{ keywords }`; it
  returns `{ channelId, channelName, inviteUrl }`. It's reachable over HTTP, so
  `server/` can be written in any runtime.
- `../PROFILE.md` for the input shape.

## TODO
- [ ] Pick runtime and add the package manifest + entry point
- [ ] Implement `suggest_rooms` / `connect`
- [ ] Register the server in the root `.mcp.json`

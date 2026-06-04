# OhWow MCP service  (slice C)

> **Implemented (v0).** Node MCP server over stdio (`src/index.js`), registered in
> the root `.mcp.json` as `ohwow`. Reuses the `../discord/` module directly.

OhWow is the MCP service every `/wonder` talks to. It receives an **approved**
wonder profile (see `../PROFILE.md`), matches people on shared `keywords`, and
drives the Discord side (via `../discord/`) to create/seed a room and issue invites.

## Run

```bash
cd server
npm install
```

Claude Code launches it automatically via the root `.mcp.json`
(`node server/src/index.js`). It reads the Discord bot token + guild ID from
`../discord/.env` (single source of creds — nothing secret lives in this folder or
in `.mcp.json`), logs into Discord once at startup, and serves `suggest_rooms` /
`connect` over stdio.

Implementation notes:
- v0 matching = `keywords` overlap, delegated to `../discord/`'s stateless
  find-or-create (`findOrCreateRoom`). No persistent state here.
- `discord.js` resolves from `../discord/node_modules` (the imported files live
  there), so this package only depends on the MCP SDK + zod.

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

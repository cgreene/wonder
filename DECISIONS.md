# Decisions log

A running, lightweight log of choices we've made and why, so the team doesn't
re-litigate settled questions. Newest at the top. These are "for now" decisions —
revisit freely, but record the change here when you do.

---

## 2026-06-04 — Discord rooms: private, disposable, stateless convergence

**Context:** Building the OhWow Discord side (`discord/`). Needed to decide how
rooms are created, shared, and cleaned up, and how the live demo gets everyone
into the same room.

**Decisions:**

1. **Rooms are private.** Each room is a private text channel, hidden from
   `@everyone`; you only get in via an invite link.
2. **One shared invite link** per room (not per-user invites) for v1.
3. **Rooms are disposable.** A user pops in, treats the room as throwaway. We do
   **not** maintain a persistent room registry or dedup store.
4. **Rooms auto-die after 24h of no activity.** A reaper checks each room's last
   message timestamp and deletes idle ones. (Seed message counts as activity, so
   an unused room dies ~24h after creation.)
5. **Convergence for the live demo is stateless.** Everyone running `/wonder`
   with overlapping keywords should land in the *same* room. We get this without
   a registry by reading existing rooms' keywords from their Discord channel
   topic (`OhWow room · …`), matching on keyword overlap, and reusing the room if
   one matches — otherwise creating a new one. Discord itself is the source of
   truth; nothing is persisted on our side.

**Why:** Keeps the service stateless and easy to stand up for a hackathon, avoids
a DB, and still delivers the demo's key moment (we all run `/wonder` and end up
together). Disposability + the 24h reaper keep the server clean on their own.

**Stack (earlier, still in force):** Node + discord.js; ORCID sign-in and Valency
enrichment are stretch/bonus, not in the v1 path (keywords only).

**Revisit if:** we need per-user invite tracking/revocation, real cross-session
persistence, or matching quality beyond keyword overlap (that belongs in the
OhWow `server/` matching brain, not the Discord layer).

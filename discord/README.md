# OhWow — Discord side

Programmatically creates a **private, keyword-seeded room** and returns a single
**shared invite link** that matched people click to join. This is build slice D
from the top-level README.

## What it does

`createRoom(client, { guildId, keywords, categoryId })`:

1. Creates a private text channel (hidden from `@everyone`) with a fun name
   derived from the first keyword, e.g. `protein-folding-salon`.
2. Posts a **seed message** built from the shared keywords so the room isn't
   empty when people arrive.
3. Creates one **shared invite link** (`https://discord.gg/…`) and returns
   `{ channelId, channelName, inviteUrl }`.

For a private channel, accepting the invite grants the joiner access to just
that channel.

## Setup

### 1. Create the bot (one time)

1. Go to <https://discord.com/developers/applications> → **New Application**, name
   it `OhWow`.
2. **Bot** tab → **Reset Token** → copy the token into `.env` as
   `DISCORD_BOT_TOKEN`. (You don't need any Privileged Gateway Intents — we only
   use the Guilds intent.)
3. **Installation** (or **OAuth2 → URL Generator**): scope `bot`, with bot
   permissions **Manage Channels**, **Create Instant Invite**, **Manage Roles**,
   **Send Messages**, **View Channels**. Open the generated URL and add the bot
   to your server.
4. In Discord: **Settings → Advanced → Developer Mode** on. Right-click your
   server icon → **Copy Server ID** → `.env` as `DISCORD_GUILD_ID`. (Optional:
   right-click a category → Copy Channel ID → `DISCORD_CATEGORY_ID`.)

### 2. Configure and run

```bash
cd discord
cp .env.example .env   # fill in token + guild id
npm install
npm run demo "protein folding" "cryo-em" "alphafold"   # prints an invite link
```

Or run it as an HTTP service for OhWow to call:

```bash
npm run serve
curl -X POST localhost:8787/rooms \
  -H 'content-type: application/json' \
  -d '{"keywords":["protein folding","cryo-em"]}'
```

## Notes / next steps

- **Shared link vs per-user invites:** v1 returns one shared link. If we later
  want to track who joined or revoke individually, switch to per-user invites.
- The shared invite is created with `maxAge: 0` / `maxUses: 0` (never expires,
  unlimited) — fine for a hackathon; tighten for anything real.
- Matching ("who belongs in a room") lives in the OhWow service, not here; this
  module just executes the Discord side once a set of keywords + people is decided.

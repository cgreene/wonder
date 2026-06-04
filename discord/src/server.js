import 'dotenv/config';
import express from 'express';
import { login } from './client.js';
import { findOrCreateRoom } from './findOrCreateRoom.js';
import { reapIdleRooms } from './reaper.js';

// Minimal HTTP front for OhWow to call. One logged-in client is reused across
// requests so we don't reconnect to the gateway every time.
const client = await login();
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, bot: client.user?.tag }));

// POST /rooms  { "keywords": ["protein folding", "cryo-em"] }
//   -> { channelId, channelName, inviteUrl, reused, overlap }
// Converges: overlapping keywords route into an existing room when one matches.
app.post('/rooms', async (req, res) => {
  const { keywords } = req.body ?? {};
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'keywords must be a non-empty array' });
  }
  try {
    const room = await findOrCreateRoom(client, {
      guildId: process.env.DISCORD_GUILD_ID,
      categoryId: process.env.DISCORD_CATEGORY_ID,
      keywords,
    });
    res.json(room);
  } catch (err) {
    console.error('findOrCreateRoom failed:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Background reaper: delete OhWow rooms idle longer than ROOM_TTL_HOURS.
const ttlHours = Number(process.env.ROOM_TTL_HOURS ?? 24);
const reapEveryMs = Number(process.env.REAP_INTERVAL_MINUTES ?? 60) * 60_000;
async function runReap() {
  try {
    const reaped = await reapIdleRooms(client, {
      guildId: process.env.DISCORD_GUILD_ID,
      maxIdleMs: ttlHours * 3_600_000,
    });
    if (reaped.length) console.log(`Reaped idle rooms: ${reaped.join(', ')}`);
  } catch (err) {
    console.error('reap error:', err.message);
  }
}
setInterval(runReap, reapEveryMs);
runReap();

const port = process.env.PORT || 8787;
app.listen(port, () =>
  console.log(`OhWow discord service on :${port} as ${client.user.tag} (TTL ${ttlHours}h)`),
);

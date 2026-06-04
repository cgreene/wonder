import { randomUUID } from 'node:crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { login } from '../../discord/src/client.js';
import { reapIdleRooms } from '../../discord/src/reaper.js';
import { findOrCreateRoom } from '../../discord/src/findOrCreateRoom.js';
import { isOhWowRoom, getServerInvite, roomUrl } from '../../discord/src/rooms.js';
import { buildServer, demoState } from './index.js';

// Remote (hosted) entrypoint: same OhWow tools as src/index.js, but served over
// Streamable HTTP so Claude Code can reach it at a URL instead of spawning it
// locally. Creds come from the platform's env vars (Railway), not a .env file.
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CATEGORY_ID = process.env.DISCORD_CATEGORY_ID || undefined;
const ADMIN_TOKEN = process.env.OHWOW_ADMIN_TOKEN;

// OAuth2: lets us add anyone (new or existing) into a private room and drop them in.
const PUBLIC_URL = process.env.OHWOW_PUBLIC_URL || '';
const CLIENT_ID = process.env.OHWOW_CLIENT_ID;
const CLIENT_SECRET = process.env.OHWOW_CLIENT_SECRET;
const REDIRECT_URI = `${PUBLIC_URL}/auth/callback`;
if (!process.env.DISCORD_BOT_TOKEN) {
  throw new Error('DISCORD_BOT_TOKEN not set');
}
if (!GUILD_ID) {
  throw new Error('DISCORD_GUILD_ID not set');
}

const client = await login(process.env.DISCORD_BOT_TOKEN);

const app = express();
app.use(express.json());

// One MCP session per client connection, keyed by the mcp-session-id header.
const transports = {};

app.get('/', (_req, res) =>
  res.json({ ok: true, service: 'ohwow-mcp', bot: client.user?.tag ?? null }),
);

app.post('/mcp', async (req, res) => {
  const sid = req.headers['mcp-session-id'];
  let transport;

  if (sid && transports[sid]) {
    transport = transports[sid];
  } else if (!sid && isInitializeRequest(req.body)) {
    // New session: build a fresh MCP server bound to this transport. All
    // sessions share the one logged-in Discord client.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    const server = buildServer(() => client);
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: no valid session id' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// GET = server->client stream (SSE), DELETE = end session. Both need a session.
const sessionRequest = async (req, res) => {
  const sid = req.headers['mcp-session-id'];
  if (!sid || !transports[sid]) {
    res.status(400).send('Invalid or missing session id');
    return;
  }
  await transports[sid].handleRequest(req, res);
};
app.get('/mcp', sessionRequest);
app.delete('/mcp', sessionRequest);

// --- OAuth "enter your room" flow -------------------------------------------
// /auth/start?room=<channelId> -> Discord consent -> /auth/callback -> the bot
// adds the user to the server (if needed) AND grants them the private room, then
// deep-links them straight into the channel. Works for members and non-members.

app.get('/auth/start', (req, res) => {
  const room = String(req.query.room || '');
  if (!CLIENT_ID || !CLIENT_SECRET || !PUBLIC_URL) {
    return res.status(503).send('OAuth not configured (OHWOW_CLIENT_ID / OHWOW_CLIENT_SECRET / OHWOW_PUBLIC_URL).');
  }
  if (!room) return res.status(400).send('Missing room.');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'identify guilds.join',
    redirect_uri: REDIRECT_URI,
    state: room,
    prompt: 'consent',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const channelId = String(req.query.state || '');
  if (!code || !channelId) return res.status(400).send('Missing code/state.');
  try {
    // 1. Exchange the code for the user's access token.
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) return res.status(400).send('OAuth exchange failed.');

    // 2. Identify the user.
    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await meRes.json();
    if (!me.id) return res.status(400).send('Could not identify user.');

    // 3. Only ever grant access to real OhWow rooms.
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !isOhWowRoom(channel)) return res.status(400).send('Unknown room.');

    // 4. Add them to the server (no-op if already a member), then grant the room.
    await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${me.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ access_token: tok.access_token }),
    });
    await channel.permissionOverwrites.create(me.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    // 5. Drop them straight into the room.
    res.redirect(`https://discord.com/channels/${GUILD_ID}/${channelId}`);
  } catch (err) {
    console.error('auth/callback failed:', err);
    res.status(500).send('Something went wrong joining your room.');
  }
});

// --- Demo control (the "artificial trigger") --------------------------------
// Flip demo mode on, and everyone who runs /wonder converges into one private
// demo room (skipping summarize/scrub). Protect with OHWOW_ADMIN_TOKEN.
function requireAdmin(req, res) {
  if (ADMIN_TOKEN && req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'bad or missing x-admin-token' });
    return false;
  }
  return true;
}

app.get('/admin/demo', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ demo: demoState });
});

// POST { "active": true, "keywords": ["protein folding","cryo-em","alphafold"] }
app.post('/admin/demo', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { active, keywords } = req.body ?? {};
  if (typeof active === 'boolean') demoState.active = active;
  if (Array.isArray(keywords) && keywords.length) demoState.keywords = keywords;
  res.json({ demo: demoState });
});

// Pre-create (or fetch) the demo room and return its invite link, so the
// presenter can open it ahead of time or share the link directly.
app.post('/admin/demo/room', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const room = await findOrCreateRoom(client, {
      guildId: GUILD_ID,
      categoryId: CATEGORY_ID,
      keywords: demoState.keywords,
    });
    const guild = await client.guilds.fetch(GUILD_ID);
    const serverInviteUrl = await getServerInvite(guild);
    res.json({
      demo: demoState,
      room: { ...room, roomUrl: roomUrl(GUILD_ID, room.channelId), serverInviteUrl },
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Background reaper: delete OhWow rooms idle > ROOM_TTL_HOURS (default 24h).
const ttlHours = Number(process.env.ROOM_TTL_HOURS ?? 24);
const reapEveryMs = Number(process.env.REAP_INTERVAL_MINUTES ?? 60) * 60_000;
setInterval(async () => {
  try {
    const reaped = await reapIdleRooms(client, { guildId: GUILD_ID, maxIdleMs: ttlHours * 3_600_000 });
    if (reaped.length) console.log('Reaped idle rooms:', reaped.join(', '));
  } catch (err) {
    console.error('reap error:', err.message);
  }
}, reapEveryMs);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`OhWow MCP (HTTP) on :${port} as ${client.user.tag} (TTL ${ttlHours}h)`));

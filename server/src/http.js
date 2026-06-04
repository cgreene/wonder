import { randomUUID } from 'node:crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { login } from '../../discord/src/client.js';
import { reapIdleRooms } from '../../discord/src/reaper.js';
import { findOrCreateRoom } from '../../discord/src/findOrCreateRoom.js';
import { buildServer, demoState } from './index.js';

// Remote (hosted) entrypoint: same OhWow tools as src/index.js, but served over
// Streamable HTTP so Claude Code can reach it at a URL instead of spawning it
// locally. Creds come from the platform's env vars (Railway), not a .env file.
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CATEGORY_ID = process.env.DISCORD_CATEGORY_ID || undefined;
const ADMIN_TOKEN = process.env.OHWOW_ADMIN_TOKEN;
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
    res.json({ demo: demoState, room });
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

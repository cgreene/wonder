import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Reuse the already-built discord/ slice directly (same Node runtime). Module
// resolution for 'discord.js' walks up from those files into discord/node_modules.
import { login } from '../../discord/src/client.js';
import { findOrCreateRoom } from '../../discord/src/findOrCreateRoom.js';
import { listOhWowRooms, parseKeywords } from '../../discord/src/rooms.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Single source of Discord creds: the discord/ package's gitignored .env. No
// token in this repo, none duplicated here.
loadEnv({ path: path.resolve(here, '../../discord/.env') });

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CATEGORY_ID = process.env.DISCORD_CATEGORY_ID || undefined;

const norm = (k) => String(k).toLowerCase().trim();
const parseList = (s) =>
  (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : null);

// Demo mode. When active, /wonder skips summarize/scrub/approval and everyone who
// runs it converges into ONE private demo room seeded with these keywords. Mutable
// at runtime via the http admin endpoints (see src/http.js); also settable at boot
// with OHWOW_DEMO=1 / OHWOW_DEMO_KEYWORDS="a,b,c".
export const demoState = {
  active: process.env.OHWOW_DEMO === '1',
  keywords: parseList(process.env.OHWOW_DEMO_KEYWORDS) ?? ['protein folding', 'cryo-em', 'alphafold'],
};

/**
 * Register the OhWow tools on an McpServer. Handlers pull the Discord client
 * lazily via getClient() so the server object can be built (and the tool API
 * validated) without a live gateway connection.
 */
export function buildServer(getClient) {
  const server = new McpServer({ name: 'ohwow', version: '0.1.0' });

  server.tool(
    'suggest_rooms',
    'Read-only. Given the approved match keywords, return existing OhWow Discord rooms ranked by keyword overlap. No side effects — safe to preview before connecting.',
    {
      keywords: z
        .array(z.string())
        .min(1)
        .describe('Approved, already-scrubbed match keywords from the wonder profile'),
    },
    async ({ keywords }) => {
      const guild = await getClient().guilds.fetch(GUILD_ID);
      const want = new Set(keywords.map(norm));
      const rooms = (await listOhWowRooms(guild))
        .map((ch) => {
          const kws = parseKeywords(ch.topic);
          const overlap = kws.map(norm).filter((k) => want.has(k)).length;
          return { channelId: ch.id, name: ch.name, keywords: kws, overlap };
        })
        .filter((r) => r.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap);
      return { content: [{ type: 'text', text: JSON.stringify({ rooms }, null, 2) }] };
    },
  );

  server.tool(
    'connect',
    'Side-effecting. Create or join an OhWow Discord room for the approved keywords and return a shared invite link the user clicks. Never auto-joins anyone. Call only after the user has approved the exact keywords.',
    {
      keywords: z
        .array(z.string())
        .min(1)
        .describe('Approved, already-scrubbed match keywords (this is the public surface — it seeds the room)'),
      wondering_about: z
        .string()
        .optional()
        .describe('Optional one-line problem statement from the wonder profile'),
    },
    async ({ keywords }) => {
      // In demo mode, ignore the caller's keywords and force everyone into the
      // shared demo room so the live demo converges deterministically.
      const effective = demoState.active ? demoState.keywords : keywords;
      const room = await findOrCreateRoom(getClient(), {
        guildId: GUILD_ID,
        categoryId: CATEGORY_ID,
        keywords: effective,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ ...room, demo: demoState.active }, null, 2) }] };
    },
  );

  server.tool(
    'join_demo',
    'Demo only. If the server is in demo mode, returns the shared demo room invite (seeded with the demo keywords) so /wonder can skip summarize/scrub/keywords entirely. Returns { active: false } when demo mode is off — in that case run the normal flow.',
    {},
    async () => {
      if (!demoState.active) {
        return { content: [{ type: 'text', text: JSON.stringify({ active: false }) }] };
      }
      const room = await findOrCreateRoom(getClient(), {
        guildId: GUILD_ID,
        categoryId: CATEGORY_ID,
        keywords: demoState.keywords,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ active: true, ...room, demoKeywords: demoState.keywords }, null, 2) }],
      };
    },
  );

  return server;
}

// Entry point: log into Discord once, then serve over stdio for Claude Code.
async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN not found (expected in discord/.env)');
  }
  const client = await login(process.env.DISCORD_BOT_TOKEN);
  const server = buildServer(() => client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio servers stay alive on the transport; nothing else to do here.
}

// Only run the server when executed directly (not when imported for tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('OhWow MCP server failed to start:', err);
    process.exit(1);
  });
}

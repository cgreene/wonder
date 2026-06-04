import 'dotenv/config';
import { login } from './client.js';
import { reapIdleRooms } from './reaper.js';

// Manual one-shot reap. Set ROOM_TTL_HOURS=0 to delete ALL OhWow rooms (handy
// for resetting between demo runs):
//   ROOM_TTL_HOURS=0 npm run reap
const ttlHours = Number(process.env.ROOM_TTL_HOURS ?? 24);

const client = await login();
try {
  const reaped = await reapIdleRooms(client, {
    guildId: process.env.DISCORD_GUILD_ID,
    maxIdleMs: ttlHours * 3_600_000,
  });
  console.log(reaped.length ? `Reaped: ${reaped.join(', ')}` : 'No idle rooms to reap.');
} finally {
  await client.destroy();
}

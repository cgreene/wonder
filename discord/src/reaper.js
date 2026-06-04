import { listOhWowRooms, lastActivityTs } from './rooms.js';

/**
 * Delete every OhWow room that's been idle longer than `maxIdleMs`. Stateless —
 * "idle" is derived from the channel's last message timestamp each run, so it
 * survives restarts and needs no stored registry.
 *
 * @returns {Promise<string[]>} names of the rooms that were reaped
 */
export async function reapIdleRooms(client, { guildId, maxIdleMs }) {
  const guild = await client.guilds.fetch(guildId);
  const now = Date.now();
  const reaped = [];

  for (const room of await listOhWowRooms(guild)) {
    const ts = await lastActivityTs(room);
    if (now - ts > maxIdleMs) {
      try {
        await room.delete(`OhWow: idle > ${Math.round(maxIdleMs / 3_600_000)}h`);
        reaped.push(room.name);
      } catch (err) {
        console.error(`reap failed for ${room.name}:`, err.message);
      }
    }
  }
  return reaped;
}

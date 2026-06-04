import { createRoom } from './createRoom.js';
import { listOhWowRooms, parseKeywords, getOrCreateInvite } from './rooms.js';

const norm = (k) => String(k).toLowerCase().trim();

/**
 * Convergence without a registry: scan the OhWow rooms that already exist in the
 * guild, find the one whose keywords overlap the request the most, and reuse it
 * if the overlap meets `minOverlap`. Otherwise create a fresh room. State is
 * read straight from Discord (channel topics), so nothing is persisted.
 *
 * @returns {Promise<{channelId, channelName, inviteUrl, reused: boolean, overlap?: number}>}
 */
export async function findOrCreateRoom(client, { guildId, keywords, categoryId, minOverlap = 1 }) {
  if (!keywords || keywords.length === 0) {
    throw new Error('findOrCreateRoom requires at least one keyword');
  }

  const guild = await client.guilds.fetch(guildId);
  const want = new Set(keywords.map(norm));

  let best = null;
  let bestOverlap = 0;
  for (const room of await listOhWowRooms(guild)) {
    const overlap = parseKeywords(room.topic).map(norm).filter((k) => want.has(k)).length;
    if (overlap > bestOverlap) {
      best = room;
      bestOverlap = overlap;
    }
  }

  if (best && bestOverlap >= minOverlap) {
    const inviteUrl = await getOrCreateInvite(best, `OhWow re-join: ${keywords.join(', ')}`);
    return { channelId: best.id, channelName: best.name, inviteUrl, reused: true, overlap: bestOverlap };
  }

  const room = await createRoom(client, { guildId, keywords, categoryId });
  return { ...room, reused: false, overlap: 0 };
}

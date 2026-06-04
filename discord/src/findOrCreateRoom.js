import { createRoom } from './createRoom.js';
import { listOhWowRooms, getOrCreateInvite, scoreRoomsByOverlap, countParticipants } from './rooms.js';
import { chooseRoom, policyFromEnv } from './chooseRoom.js';

/**
 * Convergence without a registry. State is read straight from Discord — keywords
 * live in channel topics, occupancy is the count of recent human authors — and the
 * tunable policy in chooseRoom.js decides whether to join an existing room or start
 * a fresh one.
 *
 * Optimized for SMALL groups of like-minded people: fill a matching room while it's
 * still small, and start a new one once the like-minded rooms are crowded (unless
 * one is squarely on-topic). Tune via env (OHWOW_ROOM_SOFT_CAP, OHWOW_MIN_OVERLAP,
 * OHWOW_STRONG_OVERLAP_RATIO, …) or by passing `policy`.
 *
 * @returns {Promise<{channelId, channelName, inviteUrl, reused, overlap, participants, reason}>}
 */
export async function findOrCreateRoom(client, { guildId, keywords, categoryId, policy } = {}) {
  if (!keywords || keywords.length === 0) {
    throw new Error('findOrCreateRoom requires at least one keyword');
  }
  const resolved = { ...policyFromEnv(), ...(policy || {}) };

  const guild = await client.guilds.fetch(guildId);

  // Cheap pass: score every OhWow room by keyword overlap (reads channel topics),
  // keep the eligible ones, and cap how many we'll measure occupancy for.
  const eligible = scoreRoomsByOverlap(await listOhWowRooms(guild), keywords)
    .filter((c) => c.overlap >= resolved.minOverlap)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, resolved.maxCandidatesToSize);

  // Expensive pass: measure occupancy, only for the eligible rooms, in parallel.
  const candidates = await Promise.all(
    eligible.map(async ({ room, overlap }) => ({
      room,
      id: room.id,
      name: room.name,
      overlap,
      size: await countParticipants(room, { sample: resolved.participantSample }),
    })),
  );

  const decision = chooseRoom(candidates, keywords.length, resolved);

  if (decision.action === 'join') {
    const channel = decision.room.room;
    const inviteUrl = await getOrCreateInvite(channel, `OhWow re-join: ${keywords.join(', ')}`);
    return {
      channelId: channel.id,
      channelName: channel.name,
      inviteUrl,
      reused: true,
      overlap: decision.room.overlap,
      participants: decision.room.size,
      reason: decision.reason,
    };
  }

  const room = await createRoom(client, { guildId, keywords, categoryId });
  return { ...room, reused: false, overlap: 0, participants: 0, reason: decision.reason };
}

import { ChannelType } from 'discord.js';

// All OhWow rooms carry their keywords in the channel topic behind this prefix.
// That's our entire "registry" — we read state back out of Discord itself, so
// there's nothing to persist and rooms stay disposable.
export const OHWOW_TOPIC_PREFIX = 'OhWow room · ';

export function buildTopic(keywords) {
  return OHWOW_TOPIC_PREFIX + keywords.join(', ');
}

export function parseKeywords(topic) {
  if (!topic || !topic.startsWith(OHWOW_TOPIC_PREFIX)) return [];
  return topic
    .slice(OHWOW_TOPIC_PREFIX.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOhWowRoom(channel) {
  return (
    channel?.type === ChannelType.GuildText &&
    typeof channel.topic === 'string' &&
    channel.topic.startsWith(OHWOW_TOPIC_PREFIX)
  );
}

/** Every OhWow-created text channel currently in the guild. */
export async function listOhWowRooms(guild) {
  const channels = await guild.channels.fetch();
  return [...channels.values()].filter(isOhWowRoom);
}

/**
 * Timestamp (ms) of the room's most recent activity. Uses the last message if
 * there is one, otherwise the channel's creation time. The seed message counts,
 * so a room nobody talks in is considered idle from the moment it was created.
 */
export async function lastActivityTs(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 1 });
    const last = msgs.first();
    return last ? last.createdTimestamp : channel.createdTimestamp;
  } catch {
    return channel.createdTimestamp;
  }
}

/** Reuse an existing shared invite for the channel, or mint one. */
export async function getOrCreateInvite(channel, reason) {
  try {
    const existing = await channel.invites.fetch();
    const inv = existing.first();
    if (inv) return `https://discord.gg/${inv.code}`;
  } catch {
    // fall through to creating one
  }
  const created = await channel.createInvite({
    maxAge: 0,
    maxUses: 0,
    unique: false,
    reason,
  });
  return `https://discord.gg/${created.code}`;
}

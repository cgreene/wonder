import {
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { buildTopic, getOrCreateInvite } from './rooms.js';

// Whimsical room-name parts so each room gets a "cool name" instead of a
// keyword dump. The first keyword anchors the topic; the suffix adds flavor.
const FLAVOR = [
  'atrium', 'campfire', 'huddle', 'lab', 'salon', 'nook', 'workshop',
  'roundtable', 'commons', 'studio', 'forge', 'garden',
];

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build a human-friendly, Discord-legal channel name from keywords.
 * e.g. ["protein folding", "cryo-em"] -> "protein-folding-salon"
 */
export function roomName(keywords) {
  const anchor = slug(keywords[0] || 'wonder') || 'wonder';
  const flavor = FLAVOR[Math.floor(Math.random() * FLAVOR.length)];
  return `${anchor}-${flavor}`.slice(0, 90); // Discord channel names max 100 chars
}

/** The seed message dropped into a fresh room so it isn't empty. */
export function seedMessage(keywords) {
  const list = keywords.map((k) => `\`${k}\``).join('  ·  ');
  return [
    '👋 **OhWow connected you here** because you\'re all wondering about similar things.',
    '',
    `**Shared keywords:** ${list}`,
    '',
    "Kick things off — what are you working on, and what are you stuck on or hoping to find?",
  ].join('\n');
}

/**
 * Create a private, keyword-seeded room and return a single shared invite link.
 *
 * @param {import('discord.js').Client} client - a logged-in discord.js client
 * @param {object} opts
 * @param {string} opts.guildId
 * @param {string[]} opts.keywords
 * @param {string} [opts.categoryId] - optional category to nest the channel under
 * @returns {Promise<{channelId: string, channelName: string, inviteUrl: string}>}
 */
export async function createRoom(client, { guildId, keywords, categoryId }) {
  if (!keywords || keywords.length === 0) {
    throw new Error('createRoom requires at least one keyword');
  }

  const guild = await client.guilds.fetch(guildId);
  const name = roomName(keywords);

  // Visible to anyone in the server (the server itself is the gate — people join
  // via the server invite, then open the room link). No @everyone deny, so members
  // can actually see and enter the room.
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    topic: buildTopic(keywords),
    permissionOverwrites: [
      {
        // Make sure the bot itself can manage and post. ReadMessageHistory lets
        // the reaper check the room's last activity before deleting it.
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.CreateInstantInvite,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  await channel.send(seedMessage(keywords));

  // A single shared invite. For a private channel, accepting this invite grants
  // the joiner access to just this channel.
  const inviteUrl = await getOrCreateInvite(channel, `OhWow room for: ${keywords.join(', ')}`);

  return {
    channelId: channel.id,
    channelName: name,
    inviteUrl,
  };
}

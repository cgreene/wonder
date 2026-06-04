import 'dotenv/config';
import { login } from './client.js';
import { createRoom } from './createRoom.js';

// Quick end-to-end check from the CLI:
//   node src/demo.js "protein folding" "cryo-em" "alphafold"
// Falls back to a default keyword set if none are passed.
const keywords = process.argv.slice(2);
const seed = keywords.length ? keywords : ['protein folding', 'cryo-em', 'alphafold'];

const client = await login();
try {
  const room = await createRoom(client, {
    guildId: process.env.DISCORD_GUILD_ID,
    categoryId: process.env.DISCORD_CATEGORY_ID,
    keywords: seed,
  });
  console.log('Created room:', room.channelName);
  console.log('Channel ID: ', room.channelId);
  console.log('Invite link:', room.inviteUrl);
} finally {
  await client.destroy();
}

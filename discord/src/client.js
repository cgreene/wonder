import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

/**
 * Create and log in a discord.js client. Guilds intent is all we need to
 * create channels and invites — we don't read message content.
 */
export async function login(token = process.env.DISCORD_BOT_TOKEN) {
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set (see .env.example)');
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  // Wait until the client is ready so client.user is populated.
  if (!client.isReady()) {
    await new Promise((resolve) => client.once('ready', resolve));
  }
  return client;
}

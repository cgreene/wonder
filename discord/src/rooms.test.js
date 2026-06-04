import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordOverlap, scoreRoomsByOverlap, countParticipants } from './rooms.js';

// --- keywordOverlap: case-insensitive, deduped set intersection ---

test('keywordOverlap counts shared keywords case-insensitively', () => {
  assert.equal(keywordOverlap(['AI', 'ML'], ['ai', 'robotics']), 1);
});

test('keywordOverlap dedupes repeats and trims whitespace', () => {
  assert.equal(keywordOverlap([' ai ', 'ai'], ['ai', 'ai']), 1);
});

test('keywordOverlap is 0 when nothing is shared', () => {
  assert.equal(keywordOverlap(['x'], ['y']), 0);
});

// --- scoreRoomsByOverlap: reads keywords out of the room topic ---

test('scoreRoomsByOverlap scores each room and ignores non-OhWow topics', () => {
  const rooms = [
    { id: 'a', topic: 'OhWow room · ai, ml' },
    { id: 'b', topic: 'some random channel topic' },
  ];
  const scored = scoreRoomsByOverlap(rooms, ['ai']);
  assert.equal(scored.find((s) => s.room.id === 'a').overlap, 1);
  assert.equal(scored.find((s) => s.room.id === 'b').overlap, 0);
});

// --- countParticipants: distinct non-bot authors from recent messages ---

const fakeChannel = (authors, { throws = false } = {}) => ({
  messages: {
    fetch: async () => {
      if (throws) throw new Error('missing ReadMessageHistory');
      return new Map(authors.map((a, i) => [String(i), { author: a }]));
    },
  },
});

test('countParticipants counts distinct human authors and excludes bots', async () => {
  const ch = fakeChannel([
    { id: 'u1', bot: false },
    { id: 'u1', bot: false }, // dup
    { id: 'ohwowbot', bot: true }, // seed message
    { id: 'u2', bot: false },
  ]);
  assert.equal(await countParticipants(ch), 2);
});

test('countParticipants returns 0 when history cannot be read', async () => {
  assert.equal(await countParticipants(fakeChannel([], { throws: true })), 0);
});

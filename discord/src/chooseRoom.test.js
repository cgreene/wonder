import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoom, DEFAULT_POLICY, policyFromEnv } from './chooseRoom.js';

const P = DEFAULT_POLICY; // minOverlap 1, softCap 10, strongOverlapRatio 0.6, strongOverlapMin 2

test('creates a new room when there are no candidates', () => {
  const d = chooseRoom([], 3, P);
  assert.equal(d.action, 'create');
  assert.equal(d.room, null);
});

test('creates a new room when no candidate meets minOverlap', () => {
  const d = chooseRoom([{ id: 'a', overlap: 0, size: 2 }], 3, P);
  assert.equal(d.action, 'create');
});

test('joins the only matching room when it is under the soft cap', () => {
  const d = chooseRoom([{ id: 'a', overlap: 2, size: 3 }], 4, P);
  assert.equal(d.action, 'join');
  assert.equal(d.room.id, 'a');
});

test('joins the highest-overlap room among those under the cap', () => {
  const d = chooseRoom(
    [
      { id: 'low', overlap: 1, size: 1 },
      { id: 'high', overlap: 3, size: 4 },
    ],
    5,
    P,
  );
  assert.equal(d.action, 'join');
  assert.equal(d.room.id, 'high');
});

test('breaks overlap ties toward the smaller room', () => {
  const d = chooseRoom(
    [
      { id: 'big', overlap: 2, size: 8 },
      { id: 'small', overlap: 2, size: 2 },
    ],
    4,
    P,
  );
  assert.equal(d.room.id, 'small');
});

test('fills a smaller matching room instead of overgrowing a full higher-overlap room', () => {
  const d = chooseRoom(
    [
      { id: 'full', overlap: 3, size: 12 },
      { id: 'roomy', overlap: 2, size: 3 },
    ],
    5,
    P,
  );
  assert.equal(d.action, 'join');
  assert.equal(d.room.id, 'roomy');
});

test('creates a new room when every matching room is full and none is squarely in the middle', () => {
  const d = chooseRoom([{ id: 'full', overlap: 1, size: 15 }], 5, P);
  assert.equal(d.action, 'create');
});

test('joins a full room when it is squarely in the middle (strong overlap ratio)', () => {
  const d = chooseRoom([{ id: 'full', overlap: 4, size: 15 }], 5, P);
  assert.equal(d.action, 'join');
  assert.equal(d.room.id, 'full');
});

test('does not treat a single shared keyword as squarely in the middle', () => {
  // 1 requested keyword, overlap 1 → ratio 1.0 but below strongOverlapMin (2)
  const d = chooseRoom([{ id: 'full', overlap: 1, size: 20 }], 1, P);
  assert.equal(d.action, 'create');
});

test('soft cap is tunable', () => {
  const strict = { ...P, softCap: 3, strongOverlapRatio: 0.99, strongOverlapMin: 99 };
  const d = chooseRoom([{ id: 'a', overlap: 2, size: 4 }], 4, strict);
  assert.equal(d.action, 'create'); // size 4 >= cap 3, and can't qualify as squarely-middle
});

test('policyFromEnv reads OHWOW_ROOM_SOFT_CAP and falls back to defaults', () => {
  const pol = policyFromEnv({ OHWOW_ROOM_SOFT_CAP: '5' });
  assert.equal(pol.softCap, 5);
  assert.equal(pol.minOverlap, DEFAULT_POLICY.minOverlap);
});

test('every decision includes a human-readable reason', () => {
  const d = chooseRoom([{ id: 'a', overlap: 2, size: 3 }], 4, P);
  assert.equal(typeof d.reason, 'string');
  assert.ok(d.reason.length > 0);
});

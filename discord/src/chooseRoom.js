/**
 * Room-selection policy for OhWow matching.
 *
 * Goal: *small groups of like-minded people.* Fill a matching room while it's
 * still small, and spin up a fresh one once the like-minded room gets crowded —
 * unless one existing room is so clearly on-topic ("squarely in the middle") that
 * splitting would be silly.
 *
 * Every knob is tunable via env (see policyFromEnv) or by passing a policy object.
 */
export const DEFAULT_POLICY = Object.freeze({
  minOverlap: 1, // ignore rooms sharing fewer than this many keywords
  softCap: 10, // a room with >= this many participants is "full"
  strongOverlapRatio: 0.6, // a full room still wins if it covers >= this fraction of the requester's keywords
  strongOverlapMin: 2, // ...and shares at least this many keywords (a lone shared keyword can't anchor a crowd)
  maxCandidatesToSize: 8, // cap how many rooms we measure occupancy for per request (perf bound)
  participantSample: 50, // how many recent messages to scan when counting participants
});

const toNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Build a policy from environment variables, falling back to DEFAULT_POLICY. */
export function policyFromEnv(env = process.env) {
  return {
    minOverlap: toNum(env.OHWOW_MIN_OVERLAP, DEFAULT_POLICY.minOverlap),
    softCap: toNum(env.OHWOW_ROOM_SOFT_CAP, DEFAULT_POLICY.softCap),
    strongOverlapRatio: toNum(env.OHWOW_STRONG_OVERLAP_RATIO, DEFAULT_POLICY.strongOverlapRatio),
    strongOverlapMin: toNum(env.OHWOW_STRONG_OVERLAP_MIN, DEFAULT_POLICY.strongOverlapMin),
    maxCandidatesToSize: toNum(env.OHWOW_MAX_CANDIDATES, DEFAULT_POLICY.maxCandidatesToSize),
    participantSample: toNum(env.OHWOW_PARTICIPANT_SAMPLE, DEFAULT_POLICY.participantSample),
  };
}

// Most like-minded first; ties broken toward the smaller (roomier) room.
const byPreference = (a, b) => b.overlap - a.overlap || a.size - b.size;

/** A full room is worth joining anyway only if it's squarely on the requester's topic. */
function squarelyInTheMiddle(room, requestedCount, policy) {
  if (room.overlap < policy.strongOverlapMin) return false;
  if (!requestedCount) return false;
  return room.overlap / requestedCount >= policy.strongOverlapRatio;
}

/**
 * Decide whether to JOIN an existing room or CREATE a new one.
 *
 * @param {Array<{id?:string,name?:string,overlap:number,size:number}>} candidates
 *        existing rooms with their keyword `overlap` and current participant `size`
 * @param {number} requestedCount  how many keywords the requester sent (for the ratio test)
 * @param {object} [policy=DEFAULT_POLICY]
 * @returns {{action:'join'|'create', room:object|null, reason:string}}
 */
export function chooseRoom(candidates, requestedCount, policy = DEFAULT_POLICY) {
  const eligible = (candidates ?? [])
    .filter((c) => c.overlap >= policy.minOverlap)
    .sort(byPreference);

  if (eligible.length === 0) {
    return { action: 'create', room: null, reason: 'no existing room shares enough keywords' };
  }

  // Prefer the most like-minded room that still has space.
  const roomy = eligible.find((c) => c.size < policy.softCap);
  if (roomy) {
    return {
      action: 'join',
      room: roomy,
      reason: `room has space (${roomy.size} < ${policy.softCap}) with overlap ${roomy.overlap}`,
    };
  }

  // Every matching room is full. Keep groups small by starting a fresh one —
  // unless one room is squarely in the middle of what this person asked about.
  const best = eligible[0];
  if (squarelyInTheMiddle(best, requestedCount, policy)) {
    return {
      action: 'join',
      room: best,
      reason: `all matching rooms full, but overlap ${best.overlap}/${requestedCount} is squarely on topic`,
    };
  }
  return {
    action: 'create',
    room: null,
    reason: `all matching rooms full (>= ${policy.softCap}) and none squarely on topic — new small room`,
  };
}

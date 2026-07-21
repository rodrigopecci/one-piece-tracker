/* Pure progress reconciliation shared by the app and its regression tests.
   `removed` and `added` are recent per-unit operation timestamps. Ranges remain
   the compact source of the current set; the operation maps resolve conflicts
   when two devices edit the same unit before seeing each other's changes. */

const copyTimes = map => Object.fromEntries(
  Object.entries(map || {})
    .map(([unit, time]) => [unit, Number(time) || 0])
    .filter(([, time]) => time > 0)
);

const mergeTimes = (a, b) => {
  const out = copyTimes(a);
  for (const [unit, time] of Object.entries(copyTimes(b)))
    out[unit] = Math.max(out[unit] || 0, time);
  return out;
};

/* Older app versions could save a unit in both the watched ranges and the
   removal map after it was re-checked. Membership is the only reliable signal
   in that legacy contradiction, so synthesize a slightly newer add operation
   and let the next upload repair the row. */
function repairLegacyContradictions(set, removed, added, updatedAt){
  for (const unit of set){
    const key = String(unit);
    if (removed[key] && !added[key])
      added[key] = Math.max(removed[key] + 1, updatedAt || 0);
  }
}

export function mergeProgressState({
  localSeen,
  remoteSeen,
  localRemoved,
  remoteRemoved,
  localAdded,
  remoteAdded,
  remoteUpdatedAt = 0,
}){
  const left = new Set(localSeen || []);
  const right = new Set(remoteSeen || []);
  const leftRemoved = copyTimes(localRemoved);
  const rightRemoved = copyTimes(remoteRemoved);
  const leftAdded = copyTimes(localAdded);
  const rightAdded = copyTimes(remoteAdded);

  repairLegacyContradictions(left, leftRemoved, leftAdded, 0);
  repairLegacyContradictions(right, rightRemoved, rightAdded, remoteUpdatedAt);

  const removed = mergeTimes(leftRemoved, rightRemoved);
  const added = mergeTimes(leftAdded, rightAdded);
  const seen = new Set([...left, ...right]);
  const units = new Set([...Object.keys(removed), ...Object.keys(added)]);

  for (const key of units){
    const unit = Number(key);
    const removedAt = removed[key] || 0;
    const addedAt = added[key] || 0;
    if (removedAt > addedAt){
      seen.delete(unit);
      delete added[key];
    } else if (addedAt){
      seen.add(unit);
      delete removed[key];
    }
  }

  return {seen, removed, added};
}

export function pruneChangeMap(map, cutoff){
  for (const unit in map) if ((Number(map[unit]) || 0) < cutoff) delete map[unit];
  return map;
}

export function setsEqual(a, b){
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

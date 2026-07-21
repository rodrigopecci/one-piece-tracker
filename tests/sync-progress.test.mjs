import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProgressState, setsEqual } from '../sync-progress.js';

const merge = overrides => mergeProgressState({
  localSeen:new Set(), remoteSeen:new Set(),
  localRemoved:{}, remoteRemoved:{}, localAdded:{}, remoteAdded:{},
  ...overrides,
});

test('a local uncheck wins over a stale checked cloud range', () => {
  const result = merge({
    remoteSeen:new Set([153]),
    localRemoved:{153:200},
  });
  assert.equal(result.seen.has(153), false);
  assert.equal(result.removed[153], 200);
});

test('a later local re-check wins over an older cloud removal', () => {
  const result = merge({
    localSeen:new Set([153]),
    localAdded:{153:300},
    remoteRemoved:{153:200},
  });
  assert.equal(result.seen.has(153), true);
  assert.equal(result.added[153], 300);
  assert.equal(result.removed[153], undefined);
});

test('a newer cloud uncheck removes a stale locally checked unit', () => {
  const result = merge({
    localSeen:new Set([153]),
    localAdded:{153:100},
    remoteRemoved:{153:200},
  });
  assert.equal(result.seen.has(153), false);
  assert.equal(result.removed[153], 200);
});

test('legacy rows containing both a range and removal heal as checked', () => {
  const result = merge({
    remoteSeen:new Set([153]),
    remoteRemoved:{153:200},
    remoteUpdatedAt:250,
  });
  assert.equal(result.seen.has(153), true);
  assert.equal(result.added[153], 250);
  assert.equal(result.removed[153], undefined);
});

test('equal-sized progress sets with different units count as changed', () => {
  assert.equal(setsEqual(new Set([1, 2]), new Set([1, 3])), false);
  assert.equal(setsEqual(new Set([1, 2]), new Set([2, 1])), true);
});

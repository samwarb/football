import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixtureKey,
  lastFiveForm,
  normalizeFixture,
  pointsProgression,
  selectCurrentRound
} from '../src/normalizers.js';
import { canonicalTeam } from '../src/teamIdentity.js';

test('canonicalTeam resolves common provider aliases', () => {
  assert.equal(canonicalTeam('Brighton & Hove Albion').slug, 'brighton');
  assert.equal(canonicalTeam('AFC Bournemouth').slug, 'bournemouth');
  assert.equal(canonicalTeam('Man Utd').slug, 'manchester-united');
});

test('fixtureKey normalizes provider naming differences', () => {
  assert.equal(
    fixtureKey('Brighton & Hove Albion', 'AFC Bournemouth'),
    fixtureKey('Brighton and Hove Albion', 'Bournemouth')
  );
});

test('form and progression are built from actual played fixtures', () => {
  const fixtures = [
    normalizeFixture({ idEvent: '1', intRound: '1', dateEvent: '2025-08-16', strHomeTeam: 'Arsenal', strAwayTeam: 'Chelsea', intHomeScore: '2', intAwayScore: '0' }),
    normalizeFixture({ idEvent: '2', intRound: '2', dateEvent: '2025-08-23', strHomeTeam: 'Liverpool', strAwayTeam: 'Arsenal', intHomeScore: '1', intAwayScore: '1' }),
    normalizeFixture({ idEvent: '3', intRound: '3', dateEvent: '2025-08-30', strHomeTeam: 'Arsenal', strAwayTeam: 'Manchester City', intHomeScore: '0', intAwayScore: '1' })
  ];

  assert.deepEqual(lastFiveForm(fixtures, 'arsenal'), ['L', 'D', 'W']);
  assert.deepEqual(pointsProgression(fixtures, 'arsenal').map(item => item.points), [3, 4, 4]);
});

test('selectCurrentRound chooses the round closest to the current date', () => {
  const fixtures = [
    normalizeFixture({ idEvent: '1', intRound: '1', dateEvent: '2025-08-16', strHomeTeam: 'Arsenal', strAwayTeam: 'Chelsea', intHomeScore: '2', intAwayScore: '0' }),
    normalizeFixture({ idEvent: '2', intRound: '2', dateEvent: '2025-08-23', strHomeTeam: 'Liverpool', strAwayTeam: 'Arsenal', intHomeScore: null, intAwayScore: null }),
    normalizeFixture({ idEvent: '3', intRound: '3', dateEvent: '2025-08-30', strHomeTeam: 'Arsenal', strAwayTeam: 'Manchester City', intHomeScore: null, intAwayScore: null })
  ];

  assert.equal(selectCurrentRound(fixtures, new Date('2025-08-23T12:00:00Z')), 2);
});

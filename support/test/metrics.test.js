'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { trouverCause } = require('../src/metrics');

test('trouverCause classe les rapports', () => {
  assert.equal(trouverCause({ reason: 'network' }), 'network');
  assert.equal(trouverCause({ reason: 'frame', activities: [{ name: 'visibilityHidden' }] }), 'hidden');
  assert.equal(trouverCause({ reason: 'frame', graphics: { firstCapture: true } }), 'shader');
  assert.equal(trouverCause({ reason: 'frame', work: { details: { renderOverlay: 300 } } }), 'overlay');
  assert.equal(trouverCause({ reason: 'frame', work: { details: { worldDynamics: 80 } } }), 'world');
  assert.equal(trouverCause({ reason: 'frame' }), 'generic');
});

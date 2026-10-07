'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { trouverCause } = require('../src/cause');

test('trouverCause classe les rapports', () => {
  assert.equal(trouverCause({ reason: 'network' }), 'network');
  assert.equal(trouverCause({ reason: 'frame', activities: [{ name: 'visibilityHidden' }] }), 'hidden');
  assert.equal(trouverCause({ reason: 'frame', graphics: { firstCapture: true } }), 'shader');
  assert.equal(trouverCause({ reason: 'frame', work: { details: { renderOverlay: 300 } } }), 'overlay');
  assert.equal(trouverCause({ reason: 'frame', work: { details: { worldDynamics: 80 } } }), 'world');
  assert.equal(trouverCause({ reason: 'frame' }), 'generic');
});

test('trouverCause repère les rapports impossibles', () => {
  assert.equal(trouverCause({ reason: 'frame', fps: 1200 }), 'invalide');
  assert.equal(trouverCause({ reason: 'frame', fps: 60, work: { stages: { render: -30 } } }), 'invalide');
  assert.equal(trouverCause({ reason: 'frame', activities: 'pas un tableau' }), 'generic');
});

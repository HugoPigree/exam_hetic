'use strict';

function trouverCause(report) {
  const etapes = report.work?.stages ?? {};
  const details = report.work?.details ?? {};
  const activites = Array.isArray(report.activities) ? report.activities : [];

  if (report.fps > 144 || Object.values(etapes).some((duree) => duree < 0)) {
    return 'invalide';
  }
  if (report.reason === 'network') {
    return 'network';
  }
  if (activites.some((activite) => activite.name === 'visibilityHidden')) {
    return 'hidden';
  }
  if (report.graphics?.firstCapture) {
    return 'shader';
  }
  if (details.renderOverlay > 100) {
    return 'overlay';
  }
  if (details.worldDynamics > 20) {
    return 'world';
  }
  return 'generic';
}

module.exports = { trouverCause };

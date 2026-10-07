'use strict';

const client = require('prom-client');

client.collectDefaultMetrics();

const requetesHttp = new client.Counter({
  name: 'http_requests_total',
  help: 'Nombre de requêtes HTTP reçues',
  labelNames: ['method', 'route', 'status'],
});

const dureeRequetesHttp = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée de traitement des requêtes HTTP',
  labelNames: ['method', 'route'],
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1],
});

const rapportsPerf = new client.Counter({
  name: 'perf_reports_total',
  help: 'Rapports de performance reçus',
  labelNames: ['origin', 'cause', 'build'],
});

const dureeImage = new client.Histogram({
  name: 'perf_report_frame_seconds',
  help: "Durée de l'image signalée dans les rapports",
  labelNames: ['origin', 'build'],
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
});

const partiesEnCours = new client.Gauge({
  name: 'games_in_progress',
  help: 'Nombre de parties en cours',
  labelNames: ['map'],
});

const partiesTerminees = new client.Counter({
  name: 'games_completed_total',
  help: 'Nombre de parties terminées',
  labelNames: ['map', 'quarantined'],
});

const dureeParties = new client.Histogram({
  name: 'game_duration_seconds',
  help: 'Durée réelle des parties terminées',
  labelNames: ['map'],
  buckets: [5, 10, 15, 20, 30, 45, 60, 90],
});

const ecartTick = new client.Histogram({
  name: 'server_tick_gap_seconds',
  help: 'Plus grand écart entre deux ticks serveur pendant une partie',
  buckets: [0.05, 0.06, 0.1, 0.2, 0.5, 1],
});

function trouverCause(report) {
  const details = report.work?.details ?? {};
  const activites = report.activities ?? [];

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

function enregistrerRequete(method, route, status, dureeSecondes) {
  requetesHttp.inc({ method, route, status });
  dureeRequetesHttp.observe({ method, route }, dureeSecondes);
}

function enregistrerRapport(origin, report) {
  const build = report.build ?? 'inconnu';
  rapportsPerf.inc({ origin, cause: trouverCause(report), build });
  if (typeof report.frameMs === 'number') {
    dureeImage.observe({ origin, build }, report.frameMs / 1000);
  }
}

function enregistrerEvenementFlotte(evenement) {
  if (evenement.event === 'game_created') {
    partiesEnCours.inc({ map: evenement.server.map });
  }

  if (evenement.event === 'game_completed') {
    const partie = evenement.server;
    partiesEnCours.dec({ map: partie.map });
    partiesTerminees.inc({ map: partie.map, quarantined: String(partie.quarantined) });
    dureeParties.observe({ map: partie.map }, (Date.now() - partie.createdAt) / 1000);
    ecartTick.observe(partie.tickGapMaxMs / 1000);
  }

  if (evenement.event === 'perf_spike') {
    enregistrerRapport('simulation', evenement.report);
  }
}

module.exports = { trouverCause, enregistrerRequete, enregistrerRapport, enregistrerEvenementFlotte };

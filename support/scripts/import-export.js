'use strict';

const fs = require('node:fs');

const LOKI_URL = process.env.LOKI_URL ?? 'http://localhost:3100';
const FICHIER = process.argv[2] ?? 'data/admin-export-2026-09-20_26.log';
const TAILLE_LOT = 500;

function deuxChiffres(nombre) {
  return String(nombre).padStart(2, '0');
}

function convertirDate(texte) {
  const resultat = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/);
  if (!resultat) {
    return null;
  }

  const [, mois, jour, annee, heure, minutes, secondes, periode] = resultat;
  let heure24 = Number(heure) % 12;
  if (periode === 'PM') {
    heure24 += 12;
  }

  const dateIso = `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}T${deuxChiffres(heure24)}:${minutes}:${secondes}+02:00`;
  return new Date(dateIso);
}

function decouperEnBlocs(texte) {
  const lignes = texte.split('\n');
  const blocs = [];
  let blocEnCours = null;

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (ligne.startsWith('Performance spike ') || ligne.startsWith('Game completed ')) {
      blocEnCours = { numeroLigne: i + 1, lignes: [ligne] };
      blocs.push(blocEnCours);
    } else if (blocEnCours) {
      blocEnCours.lignes.push(ligne);
    }
  }

  return blocs;
}

function transformerBloc(bloc) {
  const [titre, dateTexte] = bloc.lignes[0].split(' · ');
  const date = convertirDate(dateTexte);
  if (!date) {
    throw new Error(`date illisible : ${dateTexte}`);
  }

  const donnees = JSON.parse(bloc.lignes.slice(2).join('\n'));
  const entree = { ts: date.toISOString() };

  if (titre.startsWith('Performance spike')) {
    entree.level = 'warn';
    entree.event = 'perf_spike';
    entree.report = donnees.report;
    entree.server = donnees.server;
    if (entree.report.rttMs === undefined) {
      entree.report.rttMs = entree.report.network.rttMs;
    }
  } else {
    entree.level = 'info';
    entree.event = 'game_completed';
    entree.server = donnees;
  }

  entree.ligne = bloc.numeroLigne;
  entree.dateExport = dateTexte;
  return entree;
}

async function attendreLoki() {
  for (let essai = 1; essai <= 30; essai++) {
    try {
      const reponse = await fetch(`${LOKI_URL}/ready`);
      if (reponse.ok) {
        return;
      }
    } catch {
    }
    console.log(`Loki pas encore prêt (essai ${essai}/30)`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Loki ne répond pas');
}

async function envoyerLot(entrees) {
  const valeurs = entrees.map((entree) => [
    `${new Date(entree.ts).getTime()}000000`,
    JSON.stringify(entree),
  ]);

  const corps = {
    streams: [
      {
        stream: { service: 'game-telemetry', source: 'export' },
        values: valeurs,
      },
    ],
  };

  const reponse = await fetch(`${LOKI_URL}/loki/api/v1/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });

  if (!reponse.ok) {
    throw new Error(`Loki a répondu ${reponse.status} : ${await reponse.text()}`);
  }
}

async function main() {
  const texte = fs.readFileSync(FICHIER, 'utf8');
  const blocs = decouperEnBlocs(texte);

  const entrees = [];
  const blocsDejaVus = new Set();
  let nombreDoublons = 0;
  let nombreErreurs = 0;

  for (const bloc of blocs) {
    try {
      const entree = transformerBloc(bloc);
      const contenu = bloc.lignes.join('\n').trim();
      entree.doublon = blocsDejaVus.has(contenu);
      if (entree.doublon) {
        nombreDoublons++;
      }
      blocsDejaVus.add(contenu);
      entrees.push(entree);
    } catch (erreur) {
      nombreErreurs++;
      console.log(`Bloc ignoré (ligne ${bloc.numeroLigne}) : ${erreur.message}`);
    }
  }

  entrees.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  console.log(`${blocs.length} blocs lus, ${entrees.length} valides, ${nombreDoublons} doublons, ${nombreErreurs} erreurs`);
  console.log(`Du ${entrees[0].ts} au ${entrees[entrees.length - 1].ts} (UTC)`);

  await attendreLoki();

  for (let i = 0; i < entrees.length; i += TAILLE_LOT) {
    await envoyerLot(entrees.slice(i, i + TAILLE_LOT));
  }

  await fetch(`${LOKI_URL}/flush`, { method: 'POST' });

  console.log(`Import terminé : ${entrees.length} lignes envoyées à Loki`);
}

main().catch((erreur) => {
  console.error(erreur.message);
  process.exit(1);
});

## Installation et lancement

```bash
git clone https://github.com/HugoPigree/exam_hetic.git
cd exam_hetic
docker compose up -d --build
```
## Accès

Grafana : http://localhost:3000 
Prometheus : http://localhost:9090 
API du service : http://localhost:8080/healthz

## Arrêter

```bash
docker compose down
```

Pour tout supprimer (données Loki, Prometheus et Grafana) et repartir de zéro :

```bash
docker compose down -v
```

## Tests

```bash
cd support
npm ci
npm run lint
npm test
```

## Organisation du dépôt

- `.github/workflows/ci.yml` : pipeline (lint, tests, build, scan Trivy, push sur GHCR)
- `support/` : code du service, Dockerfile, script d'import de l'export historique
- `alloy/`, `loki/` : collecte et stockage des logs
- `prometheus/` : scraping, recording rules et règles d'alerte
- `grafana/` : sources de données et dashboards provisionnés

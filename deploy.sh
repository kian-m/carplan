#!/usr/bin/env bash
# Deploys backend + frontend to Cloud Run. Re-run after changing code or backend/.env.
#   ./deploy.sh            deploy both
#   ./deploy.sh backend    deploy only the backend (e.g. after adding keys)
set -euo pipefail

export CLOUDSDK_ACTIVE_CONFIG_NAME=hacktx
REGION=us-central1
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-all}"

# Keys in backend/.env that are stored in Secret Manager. Everything else in .env
# (model names, base URLs) is passed as a plain env var.
SECRETS=(NESSIE_API_KEY SERPAPI_API_KEY GEMINI_API_KEY TIGER_DATABASE_URL SNOWFLAKE_PAT)

if [[ "$TARGET" == "all" || "$TARGET" == "backend" ]]; then
  SECRET_FLAGS=()
  ENV_VARS=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ -z "$val" || "$key" == "CORS_ORIGINS" ]] && continue

    if [[ " ${SECRETS[*]} " == *" $key "* ]]; then
      # Create the secret, or add a new version only if the value changed.
      if ! gcloud secrets describe "$key" >/dev/null 2>&1; then
        printf '%s' "$val" | gcloud secrets create "$key" --data-file=- --replication-policy=automatic --quiet
      elif [[ "$(gcloud secrets versions access latest --secret "$key" 2>/dev/null)" != "$val" ]]; then
        printf '%s' "$val" | gcloud secrets versions add "$key" --data-file=- --quiet
      fi
      SECRET_FLAGS+=("$key=$key:latest")
    else
      ENV_VARS+=("$key=$val")
    fi
  done < "$ROOT/backend/.env"

  ARGS=(--source "$ROOT/backend" --region "$REGION" --port 8000 --allow-unauthenticated --quiet)
  if ((${#ENV_VARS[@]})); then ARGS+=(--set-env-vars "$(IFS=,; echo "${ENV_VARS[*]}")"); else ARGS+=(--clear-env-vars); fi
  if ((${#SECRET_FLAGS[@]})); then ARGS+=(--set-secrets "$(IFS=,; echo "${SECRET_FLAGS[*]}")"); else ARGS+=(--clear-secrets); fi
  gcloud run deploy backend "${ARGS[@]}"
fi

if [[ "$TARGET" == "all" || "$TARGET" == "frontend" ]]; then
  BACKEND_URL="$(gcloud run services describe backend --region "$REGION" --format 'value(status.url)')"
  gcloud run deploy frontend --source "$ROOT/frontend" --region "$REGION" \
    --allow-unauthenticated --set-env-vars "BACKEND_URL=$BACKEND_URL" --quiet
fi

gcloud run services list --region "$REGION" --format 'table(SERVICE,URL)'

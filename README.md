# HackTX 2026

Next.js frontend + FastAPI backend, already connected to the sponsor platforms below. Nothing here is tied to a specific project idea.

| Platform | Track | Backend module |
|---|---|---|
| Capital One Nessie | Capital One | `backend/app/integrations/nessie.py` |
| SerpApi | SerpApi | `backend/app/integrations/serpapi.py` |
| Gemini | MLH | `backend/app/integrations/gemini.py` |
| Tiger Data | MLH | `backend/app/integrations/tiger.py` |
| Snowflake Cortex (optional) | MLH | `backend/app/integrations/snowflake.py` |
| NHTSA vPIC + recalls/complaints (no key) | — | `backend/app/integrations/nhtsa.py` |

## Run locally

```bash
# backend → http://localhost:8000 (interactive API docs at /docs)
cd backend
cp .env.example .env   # fill in keys
uv sync
uv run fastapi dev app/main.py

# frontend → http://localhost:3000 (in another terminal)
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to the backend (see `frontend/next.config.ts`), so call the backend from the browser through `lib/api.ts`.

## Getting the keys

- **Nessie:** http://api.nessieisreal.com. Sign in with GitHub and copy your key.
- **SerpApi:** https://serpapi.com/manage-api-key. The free plan has a limited number of searches per month, so cache results while you develop.
- **Gemini:** https://aistudio.google.com/apikey
- **Tiger Data:** https://console.cloud.timescale.com. Create a free service and paste its connection string into `TIGER_DATABASE_URL`, then hit `POST /api/tiger/init` once.
- **Snowflake:** sign up for the 120-day student trial, then create a programmatic access token.

## Adding a feature

1. Add the business logic in `backend/app/` (e.g. a new router in `app/routers/`) that calls the integration modules.
2. Add a typed helper in `frontend/lib/api.ts`.
3. Build the UI under `frontend/app/`. The current `page.tsx` is a test console; replace it once you've picked an idea.

## Deploy (Google Cloud Run)

Project `hacktx26-98388a`, gcloud configuration `hacktx`.

```bash
./deploy.sh            # backend + frontend
./deploy.sh backend    # after adding/changing keys in backend/.env
./deploy.sh frontend
```

API keys from `backend/.env` are uploaded to **Secret Manager**. Cloud Run reads them at runtime, so they never go in the repo or show up in the service's settings. Other `.env` values, like `GEMINI_MODEL`, are passed as regular settings.

- Frontend: https://frontend-452375460372.us-central1.run.app
- Backend: https://backend-452375460372.us-central1.run.app/docs

`docker-compose.yml` runs the same two containers on any VM if you need another host.

## Submission checklist

- Public repo
- Demo video
- List every AI tool used in the Devpost writeup
- Name each sponsor tool in the writeup so the MLH tracks count

# MatchLens — football match predictor

A separate, early-stage football analysis app. It does not alter the existing BUEA CHOP OWNER project.

## What is built

- Responsive dashboard, fixture cards, 1X2 probability bars, competition filter, provider status, and outcome summary chart.
- Clearly labelled fictional demo mode so the interface can be tested without pretending demo data is real.
- Supabase Edge Function backend scaffold. Sports provider secrets stay server-side.
- First documented connector: football-data.org. Sportmonks connector scaffold is present; confirm the correct API plan/endpoints before enabling it.
- DollarSport and Sortsai are reserved as provider slots, but their exact official docs/API hosts and authentication formats were not verifiable. The function deliberately does not guess their endpoints.

## Prediction method (initial baseline)

The intended first live model is a transparent Elo-style baseline fitted from historical match results, then applied to upcoming fixtures. It is not machine-learning training and does not account for lineups, injuries, odds movement, weather, or team news. Do not treat its probabilities as guarantees or betting advice. The dashboard labels demo forecasts as demo-only.

## Configure the frontend

Edit `src/config.js` with the public Supabase project URL and anon key. The anon key is intended for browser use; never put any sports API secret in this file.

## Configure backend secrets

After rotating any key that was pasted into chat, set secrets in the Supabase project environment—not in this repository:

- `FOOTBALL_DATA_TOKEN`
- `SPORTMONKS_TOKEN`
- `DOLLARSPORT_API_URL` and `DOLLARSPORT_API_KEY` (only after verifying the official docs)
- `SORTSAI_API_URL` and `SORTSAI_API_KEY` (only after verifying the official docs)

The current function only calls providers with a documented adapter. Unknown-provider URLs are not fetched until their request paths, auth headers, and response schemas are confirmed.

Deploy the function with the Supabase CLI from this folder's project root, then host the static files on GitHub Pages. GitHub Pages alone cannot keep private API keys or run the backend.

## Local preview

Serve this directory with any static HTTP server. For example, `python3 -m http.server 8000` from this directory, then open `http://localhost:8000`. The demo button works without a backend.

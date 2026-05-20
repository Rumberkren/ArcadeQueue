# Cloudflare Hono Backend for ArcadeQueue

This folder contains a Cloudflare Workers backend built with Hono and D1.

## Setup

1. Install dependencies in `cloudflare-hono-backend`
   ```bash
   npm install
   ```

2. Configure Cloudflare D1
   - Add a D1 database named `arcadequeue`.
   - Ensure the `DB` binding in `wrangler.toml` points to that database.

3. Deploy
   ```bash
   npm run deploy
   ```

4. Point the frontend at the deployed worker
   - Set `NEXT_PUBLIC_API_URL` to your worker URL.

## GitHub Actions deploy

A combined deploy workflow has been added to `.github/workflows/deploy-cloudflare.yml`.

Required repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `NEXT_PUBLIC_API_URL`

The worker deploy step uses `cloudflare-hono-backend/wrangler.toml`, and the Pages deploy step publishes the frontend from `frontend/`.

## API endpoints

- `GET /api/cabinets`
- `POST /api/cabinets`
- `PUT /api/cabinets/:id`
- `DELETE /api/cabinets/:id`
- `PATCH /api/cabinets/:id/reorder`
- `GET /api/queue`
- `GET /api/queue/:cabinetId`
- `GET /api/queue/:cabinetId/time-to-finish`
- `POST /api/queue`
- `DELETE /api/queue/:id`
- `POST /api/queue/:id/cycle`
- `POST /api/queue/:id/finish`
- `POST /api/queue/:id/move`
- `GET /api/health`

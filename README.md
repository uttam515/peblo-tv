# Peblo TV

Peblo TV is a full-stack media streaming catalogue platform comprising:
- **CMS**: Single-page application for editorial and administrative management.
- **Viewer**: Responsive customer-facing media catalogue and discovery application.
- **Backend API**: FastAPI REST service with PostgreSQL database, JWT authentication, and atomic catalogue publishing.

---

## Quick Start

### Start Docker Stack
```bash
docker compose up --build
```

This single command brings up the database, API, CMS, and Viewer.

On first initialization, the stack automatically:
1. Waits for PostgreSQL to be healthy.
2. Applies Alembic database migrations.
3. Seeds the provided shows, seasons, episodes, categories, users, and artwork fixtures.
4. Generates and deploys the initial live catalogue for the Viewer.

On subsequent restarts, existing database records, user edits, and the live catalogue are preserved intact without re-seeding.

### Clean Demo / Fresh Evaluation Reset
To test or evaluate from a completely empty, fresh database:
```bash
docker compose down -v
docker compose up --build
```
This resets the PostgreSQL database volume and restarts the stack with a fresh database that automatically migrates, seeds, and deploys the initial live Viewer catalogue.

---

## Application Access & Credentials

| Service | URL | Role / Access | Credentials |
|---|---|---|---|
| **CMS** | [http://localhost:3000](http://localhost:3000) | Admin | `admin` / `adminpassword` |
| **CMS** | [http://localhost:3000](http://localhost:3000) | Editor | `editor` / `editorpassword` |
| **Viewer** | [http://localhost:3001](http://localhost:3001) | Public / Read-Only | No login required |
| **Backend API** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger Docs | Direct API |

---

## Architecture & Communication

- **Reverse Proxy**: CMS and Viewer containers run lightweight `nginx:alpine` web servers that serve production Single Page Application (SPA) bundles and reverse proxy `/auth`, `/shows`, `/seasons`, `/episodes`, `/admin`, `/catalog`, and `/storage` requests across the internal Docker bridge network to `http://api:8000`.
- **Public vs Protected**: Viewer consumes public `GET /catalog` and `GET /catalog/search` endpoints without authentication. CMS requires JWT Bearer tokens for editorial and administrative operations.
- **RBAC**:
  - `editor`: Can create, edit, and publish shows, seasons, episodes, and artwork.
  - `admin`: Can perform all editor actions + trigger live catalogue deployment (`POST /admin/catalog/publish`) and view deployment history.
- **Atomic Publishing**: `POST /admin/catalog/publish` validates all published shows, seasons, and episodes (checking sections, durations, and poster/banner/thumbnail artwork), generates the snapshot, and writes `catalogue.json` atomically.

---

## Running Automated Tests

```bash
# Run Backend Pytest suite in Docker
docker compose exec api pytest

# Run CMS Vitest suite
cd cms && npm test

# Run Viewer Vitest suite
cd viewer && npm test
```

---

## Data & Ingestion Invariants

- **Duplicate Episode Resolution (`ep_0004` vs `ep_9001`)**: The raw seed dataset contains two Hindi entries for the content group `motis-many-lives-s01e02`. `ep_9001` is ingested as the revised version of `ep_0004`, maintaining the strict `(content_group, language)` uniqueness constraint (resulting in 94 episodes across 8 shows).
- **Season 0 Exclusion**: Season 0 is reserved for trailers and promotional material, and is excluded from the public catalogue and normal season list.
- **Language Variant Collapse**: Multiple language variants sharing a `content_group` are collapsed into a single `CatalogueEpisode` with a `languages` array and canonical English metadata fallback.

---

## Optional Development Commands

If you need to manually re-run migrations, seeding, or publish operations during local development:

```bash
# Run migrations manually
docker compose exec api alembic upgrade head

# Run seed script manually
docker compose exec api python -m app.seed

# Run bootstrap script manually
docker compose exec api python -m app.bootstrap
```
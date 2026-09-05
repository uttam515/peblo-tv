# Peblo TV Mini — Submission Notes

## Quick Start

```bash
docker compose up --build
# full reset: docker compose down -v && docker compose up --build
```

| Service | URL | Credentials |
|---|---|---|
| CMS | http://localhost:3000 | `admin` / `adminpassword` · `editor` / `editorpassword` |
| Viewer | http://localhost:3001 | public |
| API | http://localhost:8000/docs | — |

First run auto-migrates, seeds, and deploys the initial catalogue. Restarts preserve everything.

---

## How I Approached It

I read `seed_shows.json` and `reference.json` before writing any code. I wanted to understand what the data actually implied rather than just following the spec. From that I figured out the data model, defined the publish boundary, and built the CMS and Viewer around it. Rough order: schema → seed/ingest → catalogue generation → API → CMS → Viewer → Docker → tests.

---

## What I Found in the Data

The seed has 95 raw episode rows, but `ep_0004` and `ep_9001` share the same `(content_group, language)` — the spec doesn't mention this. I treated `ep_9001` as a revision of `ep_0004` and explicitly replaced it in the seed code. Any other unexpected duplicate raises a hard error instead of silently picking a winner.

A few other things I treated as real constraints:
- `content_group` is the grouping key for language variants. Multiple episodes with the same `content_group` collapse into one catalogue entry with a `languages` list.
- Season 0 is reserved for trailers (it says so in `reference.json`) and gets excluded from the public catalogue.
- `section`, `category`, `language` are closed enumerations — invalid values in the seed fail loudly at ingest.
- The `data/artwork/` folder has intentionally broken fixtures (`banner_too_big.png`, `thumb_tiny.jpg`). Only the `_good` ones are used for seeding.

---

## Decisions I Made Where the Spec Was Vague

- **Canonical language:** when collapsing variants, English wins. If no English, alphabetically first. The `languages` list always has all of them.
- **Fresh vs existing DB:** I use `shows == 0 AND users == 0` as the fresh-install check. Either table having data means "existing" — nothing gets re-seeded. Deleted content stays deleted.
- **Initial catalogue on fresh install:** after seeding, the bootstrap runs the same validation + generation + atomic write path that the admin publish endpoint uses. The first `PublishRun` is attributed to `system`.
- **Validation failure:** records a `status="failed"` run with error details and returns 422 without touching the live `catalogue.json`.

---

## Publishing: How It's Made Safe

`POST /admin/catalog/publish` does this:

1. Validate all published shows/episodes (section, duration, artwork). Fail early, record the error, don't touch anything.
2. Generate the new catalogue in memory.
3. Write to a temp file (`.catalogue.json.tmp.<uuid>`) in the same directory, with `flush()` + `fsync()`.
4. `os.replace(temp, target)` — atomic on POSIX. Readers always see a complete file, never a partial one.
5. Record a successful `PublishRun`.

If the process dies between 3 and 4, the temp file is cleaned up on next run and the live catalogue is untouched. If it dies after 4 but before 5, the catalogue is live but unrecorded — annoying but not broken.

---

## Why a Catalogue File Instead of DB Queries

The Viewer is read-only and stateless. Serving a pre-built JSON file means zero DB connections for normal viewer traffic, and the admin explicitly controls what viewers see by choosing when to publish. CMS state and viewer-visible state are intentionally separate — that's the workflow, not a limitation.

Where it hurts: search and filtering parse the whole `catalogue.json` on every request. For this dataset (~94 collapsed episodes) it's fine. At significantly larger scale or with more complex search requirements, I'd build a proper read model or search index fed by a publish event.

---

## Storage and R2

`StorageBackend` is an abstract class. `LocalStorage` is the only implementation. The artwork router and the publish endpoint both depend on the abstraction, not the filesystem. Swapping to R2 means writing an `R2Storage` class and changing `get_storage()` — nothing else. The `_resolve_path` method in `LocalStorage` already blocks path traversal by checking `resolved.relative_to(base_dir)`.

---

## Validation

Everything is server-side. The UI doesn't gate anything the API doesn't also gate:
- Artwork: Pillow checks it's actually an image, exact dimensions, 200 KB max, JPEG/PNG/WebP only.
- Published episodes need `duration_seconds > 0` — enforced at both schema level and publish time.
- Published shows need a valid section — enforced at publish time (section can be null at create).
- `(content_group, language)` and slugs are `UniqueConstraint` at the DB level, not just API logic.
- Publish validation returns structured errors per entity so an editor knows exactly what's blocking them.

---

## Things I Added That Weren't Explicitly Required

- Auto-bootstrap on fresh install (migrate + seed + deploy catalogue in one `docker compose up`).
- `GET /admin/catalog/status` shows whether there are unpublished changes, and which shows/episodes changed since the last publish.
- Publish history with per-run counts and version strings.
- When a published show is returned to draft, its episodes cascade to draft too.
- Deterministic catalogue ordering: `featured → series → minisodes → songs`, shows alphabetical, seasons/episodes ascending.
- Seed validation against `reference.json` enumerations at ingest — invalid data fails loudly.

---

## Problems I Actually Hit

**Async relationship loading**: SQLAlchemy async doesn't allow lazy loading outside a session. Getting `selectinload(Show.seasons).selectinload(Season.episodes).selectinload(Episode.artwork)` right without N+1 queries took a few tries.

**Season label duplication**: the seed data has titles like `"Season 1"` and the frontend was building `"Season N - {title}"`, giving `"Season 1 - Season 1"`. Fixed by checking whether the title is already equivalent to the computed label before appending it.

**Draft changes triggering "pending" status**: early version of the status diff flagged edits to draft-only shows as pending changes. Fixed by scoping the diff to published shows only.

---

## Search: Where It Breaks Down

`q` matches show titles, categories, and episode titles (case-insensitive substring). `section`, `language`, `category` are exact filters. All filters compose with AND. Filtering happens in Python over the parsed `catalogue.json` — no index, no DB.

Fine for this scale. Would stop being fine if the catalogue JSON grows large enough that parsing it on every request is expensive, or if search needs ranking/fuzzy matching. At that point I'd index the catalogue into something like Typesense on each successful publish.

---

## What I Left Out

- **Video playback**: no actual video assets, so a player would've been dead UI. The data model has `episode_id` and `content_group` ready for it.
- **Scheduled publishing**: nothing in the spec requires it and adding a worker increases infrastructure complexity for no clear editorial benefit.
- **Catalogue rollback**: would need version storage. Felt out of scope.

---

## AI Usage

I used Claude (Antigravity IDE) a lot — for API routers, service logic, test generation, frontend components, and Docker/CI config. I didn't treat the output as correct by default.

Two concrete places I rejected or fixed it:

1. The initial bootstrap generated the catalogue using a simplified write path that skipped validation. I rewrote it to go through the same `validate → generate → save_atomic` path as the admin endpoint, because a first-run catalogue that bypasses validation is strictly worse.
2. The `changes_pending` logic in the status endpoint was diffing all shows including draft-only ones, which caused false positives. I spotted it during testing and fixed the scope.

I ran builds and tests after every non-trivial change and manually verified the key flows in the running stack.

---

## Testing

Areas I considered risky and tested hardest: publish atomicity, content-group collapse, RBAC, bootstrap fresh/existing detection, artwork validation.

- Backend (pytest, SQLite in-memory): 93 tests across 9 files. Run with `docker compose exec api pytest`.
- CMS (vitest): 49 tests — all pass, build passes.
- Viewer (vitest): 34 tests — all pass, build passes.
- CI: GitHub Actions runs all three suites + a Docker compose build check on every push.

---

## Time Spent (approx)

| | Hours |
|---|---|
| Backend / API | ~10 |
| CMS | ~8 |
| Viewer | ~5 |
| Docker, CI, operability | ~3 |
| Testing and debugging | ~6 |
| README | ~1 |
| **Total** | **~33** |

I prioritized correctness of the publish pipeline — atomic writes, validation, bootstrap, status tracking — over stretch features.

---

The thing I wanted to get right most was the line between what an editor saves and what a viewer actually sees. Every decision around atomicity, validation-before-publish, and draft isolation was about making that line explicit and safe. An editor changing a draft show should have zero effect on the live Viewer until someone deliberately publishes.
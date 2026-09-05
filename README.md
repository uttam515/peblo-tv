# Peblo TV Mini — Submission Notes

## Quick Start

```bash
docker compose up --build       # first run: migrates, seeds, deploys catalogue
docker compose down -v && docker compose up --build   # full reset
```

| Service | URL | Credentials |
|---|---|---|
| CMS | http://localhost:3000 | `admin` / `adminpassword` (or `editor` / `editorpassword`) |
| Viewer | http://localhost:3001 | public |
| API docs | http://localhost:8000/docs | — |

---

## How I Approached It

I started by reading all of `seed_shows.json` and `reference.json` before touching any code. My goal was to understand the invariants that the data implied, not just the ones the spec stated. From that I derived the data model, defined the publish boundary, and built everything — CMS and Viewer — around that boundary as a stable contract. The sequence was roughly: schema and migrations → seed/ingest with validation → catalogue generation and atomic write → API → CMS → Viewer → Docker operability → tests.

---

## What I Found in the Provided Data

The seed file contains 95 raw episode rows. The first thing I noticed was that `ep_0004` and `ep_9001` share the same `(content_group, language)` pair (`motis-many-lives-s01e02`, `hi`). The spec doesn't call this out, so I treated it as a real-world data revision: `ep_9001` is the newer episode_id for the same slot, and the seed code explicitly replaces `ep_0004` with `ep_9001` rather than treating it as a generic deduplication. Any other unexpected duplicate raises a hard error rather than silently winning.

Other things I treated as constraints rather than assumptions:
- `content_group` is the grouping key for language variants — episodes sharing a `content_group` must collapse into one catalogue entry with a `languages` array.
- Season 0 is explicitly reserved for trailers in `reference.json` and must not appear in the normal published catalogue.
- `section`, `category`, and `language` values are closed enumerations. Invalid values in the seed raise an error at ingest time, not silently land in the database.
- The `data/artwork/` directory contains both valid and intentionally invalid files (`banner_too_big.png`, `thumb_tiny.jpg`). I treated these as test fixtures for validation, not as real artwork to seed. Only `poster_good.jpg`, `banner_good.jpg`, and `thumb_good.jpg` are used during seeding.
- The seed data mixes published and draft content. I preserved both statuses exactly — the initial published catalogue only includes what was genuinely published in the seed.

---

## Ambiguities and Decisions

**Canonical language for a collapsed episode:** the spec says collapse variants but doesn't say which one's metadata wins. I chose English as canonical and fall back to alphabetically-first language if no English variant exists. The `languages` array always contains all variants.

**Fresh database vs existing database:** the spec says "seed on startup" but doesn't specify what "startup" means for a container restart. I chose a strict condition — `shows == 0 AND users == 0` — to detect a genuinely fresh install. A database with either shows or users is treated as existing and is never re-seeded. Deleted content is not restored.

**Initial catalogue on fresh install:** the spec says "seeded and working" after `docker compose up`. This requires a live catalogue. On a fresh database, after seeding, the bootstrap automatically generates and deploys the initial `catalogue.json` via the same validation and generation path that the admin publish endpoint uses. The first PublishRun record is attributed to `triggered_by="system"`.

**Publishing on validation failure:** I decided validation failure should record a `status="failed"` PublishRun (so editors can see why) and return the errors without touching the existing `catalogue.json`. The live catalogue stays intact regardless.

**Search implementation:** search and filtering operate over the in-memory parsed `catalogue.json` on the API server. This is appropriate for the challenge's data scale. It would not be appropriate beyond a few thousand episodes or with high concurrent traffic — see the search section below.

**Video playback:** not implemented. The challenge spec mentions it as a stretch goal, and the catalogue structure supports it (the `content_group` and `episode_id` fields are present), but adding a player without actual video assets would have been cosmetic.

**Local storage vs R2:** addressed below.

---

## The Publishing Guarantee

`POST /admin/catalog/publish` follows this sequence:

1. Validate all published shows and episodes (section, duration, artwork completeness). If validation fails, record a failed PublishRun and return 422. The existing `catalogue.json` is not touched.
2. Generate the new catalogue structure in memory from the current database state.
3. Write to a temporary file in the same directory as `catalogue.json` — named `.catalogue.json.tmp.<uuid>` — using `f.write()` followed by `f.flush()` and `os.fsync(f.fileno())` to flush to disk.
4. Call `os.replace(temp, target)`, which is atomic on POSIX systems. A reader that opens `catalogue.json` at any point either gets the previous complete file or the new complete file. There is no observable intermediate state.
5. Record a successful PublishRun in the database.

If the process dies after step 3 but before step 4, the `.tmp.*` file is cleaned up in the `finally` block on next attempt and the existing `catalogue.json` is untouched. If it dies after step 4 but before step 5, the new catalogue is live but the run is unrecorded — a cosmetic inconsistency, not a data integrity issue. Readers always see a complete, valid file.

I did not implement a rollback endpoint. If a bad publish goes live, an admin re-publishes. Rollback would require retaining previous catalogue versions, which felt outside the challenge scope.

---

## Why a Pre-Published Catalogue File

The Viewer is read-heavy and stateless. Serving `catalogue.json` directly — a single file read per request — is cheap, requires no database connection for viewer traffic, and gives the Viewer exactly the snapshot the admin explicitly approved. The CMS/database state and the viewer-visible state are intentionally decoupled.

The cost is that edits don't become viewer-visible until an admin publishes. This is the correct behaviour: it is not a limitation, it is the editorial workflow. An editor who wants to preview unpublished content does so through the CMS, not the Viewer.

Where this bites: search and filtering operate over the published catalogue in memory. For the current data size (8 shows, ~94 collapsed episodes), this is fast enough. The approach breaks down when the catalogue is large enough that loading and parsing the full JSON per search request becomes the bottleneck, or when the search requirements grow beyond simple substring and field-filter matching. At that point I would introduce a separate read model — likely a document store or a search index built from a catalogue update event — so the search path doesn't depend on full catalogue deserialization.

---

## Storage and R2

`StorageBackend` is an abstract class with `save`, `save_atomic`, `delete`, `exists`, and `read` methods. The artwork router and the catalogue publish code both depend on this abstraction, not on the filesystem directly. `LocalStorage` is the only implementation.

To move to Cloudflare R2: implement a `R2Storage(StorageBackend)` class using the R2 S3-compatible API, inject it via `get_storage()` (or via environment-based factory selection), and nothing else changes. The `save_atomic` implementation for R2 would use a distinct object key for the temp write and then a single `CopyObject` + `DeleteObject` swap — R2 supports conditional writes which makes this straightforward. The path containment check in `_resolve_path` becomes irrelevant for object storage; the equivalent is validating key prefixes.

The current `_resolve_path` method already raises on path traversal attempts (`../` etc.) by checking `resolved.relative_to(base_resolved)`.

---

## Validation

Server-side throughout. The UI enforces nothing that the API doesn't also enforce:

- Artwork: Pillow validates that the file is actually an image (not just a renamed binary). Exact pixel dimensions are checked. 200 KB ceiling. JPEG, PNG, WebP only.
- Published episodes must have `duration_seconds > 0`. This is enforced both at the API schema level (`model_validator`) and at publish time.
- Published shows must have a valid section. This is enforced at publish time, not just at create time, because section can be set to null.
- `(content_group, language)` uniqueness is a database `UniqueConstraint`, not just API logic.
- Slug uniqueness is a database `UniqueConstraint`.
- Validation errors from publish return structured `{entity_type, entity_id, title, error}` items so editors can identify exactly which record is blocking publication.

---

## Things I Added Beyond the Minimum

These were choices about operability and editor experience, not feature count:

- **Automatic Docker bootstrap**: on a fresh database the stack migrates, seeds, and deploys an initial catalogue without any manual steps. On restart it detects the existing database and does nothing.
- **Catalogue status and pending-changes diff**: the `GET /admin/catalog/status` endpoint compares the current database state against the live `catalogue.json` and reports which shows/episodes/artwork have changed since the last publish. Editors know whether they need to publish before seeing the "changes pending" indicator in the CMS.
- **Publish history**: every publish attempt — success or failure — is recorded in the `publish_runs` table with counts, a version string, and a summary. The admin can see the history and previous counts.
- **Show-level publish workflow**: a show can be promoted from draft to published through the CMS without touching individual episodes. Episodes follow the show's status via a cascade (returning a show to draft cascades all its episodes).
- **Artwork replace/delete**: artwork upload is idempotent — uploading a new poster replaces the old one in-place. A delete endpoint exists for each artwork type.
- **Deterministic catalogue ordering**: sections always emit in fixed order (`featured → series → minisodes → songs`), shows alphabetically by title within section, seasons by number, episodes by number. The output is reproducible.
- **Seed data validation at ingest**: the seed code validates sections, categories, and languages against `reference.json` enumerations and raises immediately on anything outside those constraints rather than silently landing invalid data in the database.

---

## Problems I Ran Into

**Async SQLAlchemy relationship loading**: eager-loading the full show → season → episode → artwork graph in one query for catalogue generation took some iteration. `selectinload` chains are order-sensitive and SQLAlchemy's async mode doesn't allow lazy loading outside a session context. Getting the correct `selectinload(Show.seasons).selectinload(Season.episodes).selectinload(Episode.artwork)` chain without N+1 queries took a few attempts.

**Fresh database vs stale storage state**: on the first iteration, the bootstrap seeded the database but the initial catalogue was not deployed because I hadn't wired the generation step into the bootstrap. The Viewer showed a 404. I then considered just writing a simpler catalogue generation path for bootstrap, but decided the correct fix was to call the same `validate_publishable_content` → `generate_catalog_structure` → `save_atomic` path used by the admin endpoint, so the bootstrap catalogue is subject to identical validation rules and there's only one code path.

**Season label duplication in the Viewer and CMS**: the seed data carries season titles like `"Season 1"` and the frontend was constructing labels by prefixing `"Season N - {title}"`. The result was `"Season 1 - Season 1"`. Fixed by normalizing: if the title is identical to the computed label (case-insensitively), use the label alone.

**Draft isolation in catalogue status**: a first draft of the `changes_pending` logic flagged any edit to any show — including draft-only shows — as a pending change. An editor touching an entirely unpublished show should not cause the "changes pending" indicator to fire. Fixed by scoping the diff to published shows only.

---

## Search: Current Limit and Next Step

`q` matches show titles, show category names, and episode titles (case-insensitive substring). `section`, `language`, and `category` are exact filters. All filters compose with AND semantics. Filtering is done in Python over the parsed `catalogue.json` on each request — no index, no database.

This is appropriate at the current scale. The full parsed catalogue for this assessment is a few hundred kilobytes and a few hundred episodes; filtering it in memory is sub-millisecond. The approach becomes questionable when: the catalogue JSON grows beyond a few megabytes (parse cost per request), when search requires ranking or fuzzy matching, or when concurrent viewer traffic is high enough that catalogue deserialization becomes a meaningful CPU cost. At that point I would emit a catalogue-updated event on each successful publish and have a background job sync it into a search index (Typesense or Elasticsearch for the search case; a CDN-cached static file for the browse case).

---

## What I Left Out

- **Video playback**: no video assets exist; a player without content would be dead UI. The data model supports it.
- **Scheduled/background publishing**: nothing in the spec requires it and adding a background worker (Celery, APScheduler, etc.) would meaningfully increase the infrastructure complexity without improving the CMS workflow.
- **Dry-run diff before publish**: partially present in the status endpoint's `pending_changes` response, but there's no explicit "preview what would change" step before committing a publish. Worth adding in a real system.
- **Catalogue rollback**: not implemented. Retaining previous catalogue versions would require version storage, which I didn't build.
- **Cloud deployment, R2, real auth hardening**: all out of scope for the assessment. The storage abstraction is the explicit accommodation for R2.

---

## AI Usage

I used Claude (via the Antigravity IDE) substantially throughout — for initial implementation of API routers and service logic, test generation, frontend component scaffolding, and debugging. I also used it for the Docker and CI configuration.

I did not treat the output as automatically correct. Concrete examples of where I exercised judgment:

- The initial bootstrap implementation generated and deployed the catalogue using a simplified catalogue-writing path that bypassed validation. I rejected that and rewrote it to call the full validation + generation service, because a first-run catalogue that skips validation is worse than no catalogue.
- The first version of the `changes_pending` logic in the status endpoint flagged draft-only show edits as pending changes. I identified this as a false positive, understood why it happened (the code was diffing all shows, not scoped to published ones), and corrected it.
- The CMS season label duplication (`"Season 1 - Season 1"`) was introduced by generated code constructing labels without checking whether the title was already semantically equivalent to the label. I caught it during a UI review, traced the cause, and fixed the normalization in both CMS and Viewer.
- Generated test code sometimes tested the API at the wrong layer or asserted on fields the endpoint didn't return. I reviewed every test file and corrected the assertions rather than adjusting the API to pass wrong tests.

I ran all tests and builds after every non-trivial change. I manually verified key UI flows — login, show creation, artwork upload, publish, Viewer browsing — in the running Docker stack.

---

## Testing

I considered the riskiest areas to be: publish atomicity and failure behavior, content-group language collapse, RBAC (editor vs admin), and the bootstrap fresh-vs-existing detection. Those got the most thorough backend tests.

Backend tests (pytest, SQLite in-memory): 93 test cases across 9 files — auth, shows, seasons, episodes, artwork, catalogue publish, catalogue search, and bootstrap. Run with `docker compose exec api pytest`.

Frontend tests (vitest): 49 CMS tests, 34 Viewer tests. Both suites and production builds pass locally (`npm test`, `npm run build`).

CI: GitHub Actions runs all three suites plus a Docker compose build check on every push.

---

## Time Spent (approximate)

| Area | Hours |
|---|---|
| Backend / API | ~10 |
| CMS | ~8 |
| Viewer | ~5 |
| Docker, CI, operability | ~3 |
| Testing and debugging | ~6 |
| README and documentation | ~1 |
| **Total** | **~33** |

The main trade-off I made was spending time on correctness and operability of the content → publish → Viewer pipeline — the bootstrap, atomic write, status tracking, and validation — rather than on stretch features like rollback, dry-run diffs, or a more sophisticated search implementation.

---

## Final Note

The thing I cared most about getting right was the boundary between what an editor saves in the CMS and what a viewer actually sees. Every decision about atomic writes, validation-before-publish, bootstrap ordering, and draft isolation was in service of making that boundary explicit, safe to operate, and easy to reason about. An admin should be able to publish without worrying about a partially written catalogue file; and an editor making changes to draft content should have no effect on what the Viewer serves until someone deliberately crosses that boundary.
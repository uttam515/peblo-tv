# Peblo TV

Catalogue CMS and Viewer Platform.

## Database Seeding

To run database migrations and seed reference and show data inside Docker:

```bash
# Apply migrations
docker compose exec api alembic upgrade head

# Run seed script
docker compose exec api python -m app.seed
```

## Data and Seed Decisions

- **Duplicate Episode Conflict (`ep_0004` vs `ep_9001`)**: The seed contains two Hindi records for the same content group (`ep_0004` and `ep_9001`). We treat `ep_9001` as the revised source record and retain it, while preserving the database uniqueness constraint on `(content_group, language)`.
- **Database Constraints**: The database uniqueness constraint on `(content_group, language)` remains strictly enforced, resulting in 94 imported episodes from the 95 raw source rows.
- **Reference Integrity**: Categories, sections, and languages are validated against `data/reference.json` during ingestion.
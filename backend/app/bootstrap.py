import asyncio
from datetime import datetime, timezone
import logging
import os
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_maker
from app.models import PublishRun, Show, User
from app.seed import seed_database
from app.services.catalog import (
    generate_catalog_structure,
    validate_publishable_content,
)
from app.storage import StorageBackend, get_storage

LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.WARNING), format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def run_bootstrap(session: AsyncSession, storage: StorageBackend) -> dict:
    shows_count = (await session.execute(select(func.count(Show.id)))).scalar_one()
    users_count = (await session.execute(select(func.count(User.id)))).scalar_one()

    is_fresh_db = shows_count == 0 and users_count == 0
    seeded = False
    catalogue_deployed = False

    if is_fresh_db:
        logger.info("Fresh database detected (0 shows, 0 users). Running initial seed...")
        await seed_database(session)
        seeded = True
        logger.info("Initial seed completed.")

        logger.info("Deploying initial Viewer catalogue for fresh installation...")
        start_time = datetime.now(timezone.utc)
        errors, published_shows = await validate_publishable_content(session)

        if errors:
            logger.error("Initial catalogue generation failed validation with %d error(s)", len(errors))
        else:
            catalog_data, s_count, ep_count = generate_catalog_structure(published_shows)
            catalogue_version = f"v_{start_time.strftime('%Y%m%d%H%M%S')}"
            catalog_json = catalog_data.model_dump_json(indent=2)

            await storage.save_atomic(
                "catalogue.json",
                catalog_json.encode("utf-8"),
                content_type="application/json",
            )

            run = PublishRun(
                triggered_by="system",
                status="success",
                shows_count=s_count,
                episodes_count=ep_count,
                catalogue_version=catalogue_version,
                started_at=start_time,
                completed_at=datetime.now(timezone.utc),
                summary=f"Initial bootstrap catalogue deployment ({catalogue_version})",
            )
            session.add(run)
            await session.commit()
            catalogue_deployed = True
            logger.info(
                "Initial Viewer catalogue deployed: %s with %d shows and %d episodes.",
                catalogue_version,
                s_count,
                ep_count,
            )
    else:
        logger.info(
            "Existing database detected (%d shows, %d users). Preserving all data and catalogue state without reseeding.",
            shows_count,
            users_count,
        )

    return {
        "is_fresh_db": is_fresh_db,
        "seeded": seeded,
        "catalogue_deployed": catalogue_deployed,
    }


async def main():
    storage = get_storage()
    async with async_session_maker() as session:
        await run_bootstrap(session, storage)


if __name__ == "__main__":
    asyncio.run(main())

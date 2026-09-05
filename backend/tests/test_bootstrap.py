import json
from pathlib import Path
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap import run_bootstrap
from app.models import Episode, PublishRun, Show, User
from app.storage import LocalStorage


@pytest.fixture
def temp_storage(tmp_path: Path) -> LocalStorage:
    return LocalStorage(base_dir=str(tmp_path / "storage"))


@pytest.mark.asyncio
async def test_fresh_db_bootstrap_seeds_and_deploys_catalogue(
    db_session: AsyncSession, temp_storage: LocalStorage
):
    # Ensure completely empty database for fresh install test
    await db_session.execute(User.__table__.delete())
    await db_session.execute(Show.__table__.delete())
    await db_session.commit()

    # Initial bootstrap on fresh install
    result = await run_bootstrap(db_session, temp_storage)

    assert result["is_fresh_db"] is True
    assert result["seeded"] is True
    assert result["catalogue_deployed"] is True

    # Verify seed counts
    shows_count = (await db_session.execute(select(func.count(Show.id)))).scalar_one()
    episodes_count = (await db_session.execute(select(func.count(Episode.id)))).scalar_one()
    users_count = (await db_session.execute(select(func.count(User.id)))).scalar_one()

    assert shows_count > 0
    assert episodes_count == 94
    assert users_count >= 2

    # Verify catalogue.json was created and valid
    assert await temp_storage.exists("catalogue.json")
    content = await temp_storage.read("catalogue.json")
    cat_data = json.loads(content)
    assert "sections" in cat_data
    assert len(cat_data["sections"]) == 4

    # Verify PublishRun record created
    runs = (await db_session.execute(select(PublishRun))).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "success"
    assert runs[0].triggered_by == "system"


@pytest.mark.asyncio
async def test_fresh_db_bootstrap_with_stale_storage_file_deploys_fresh_catalogue(
    db_session: AsyncSession, temp_storage: LocalStorage
):
    # Ensure empty database
    await db_session.execute(User.__table__.delete())
    await db_session.execute(Show.__table__.delete())
    await db_session.commit()

    # Pre-populate stale catalogue.json in storage
    stale_data = json.dumps({"sections": [], "stale": True}).encode("utf-8")
    await temp_storage.save_atomic("catalogue.json", stale_data, content_type="application/json")

    # Initial bootstrap
    result = await run_bootstrap(db_session, temp_storage)

    assert result["is_fresh_db"] is True
    assert result["seeded"] is True
    assert result["catalogue_deployed"] is True

    # Verify catalogue.json was replaced with fresh valid data
    content = await temp_storage.read("catalogue.json")
    cat_data = json.loads(content)
    assert "stale" not in cat_data
    assert len(cat_data["sections"]) == 4

    # Verify PublishRun was created
    runs = (await db_session.execute(select(PublishRun))).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "success"


@pytest.mark.asyncio
async def test_existing_db_restart_preserves_data_and_catalogue(
    db_session: AsyncSession, temp_storage: LocalStorage
):
    # Empty DB and run first fresh bootstrap
    await db_session.execute(User.__table__.delete())
    await db_session.execute(Show.__table__.delete())
    await db_session.commit()

    first_result = await run_bootstrap(db_session, temp_storage)
    assert first_result["is_fresh_db"] is True

    # Editor modifies a show title in CMS
    stmt = select(Show).limit(1)
    show = (await db_session.execute(stmt)).scalars().first()
    original_id = show.id
    show.title = "Custom User Edited Title"
    await db_session.commit()

    # Read catalogue content
    original_cat = await temp_storage.read("catalogue.json")

    # Second bootstrap (e.g. docker container restart)
    second_result = await run_bootstrap(db_session, temp_storage)

    assert second_result["is_fresh_db"] is False
    assert second_result["seeded"] is False
    assert second_result["catalogue_deployed"] is False

    # Check that edited title was NOT overwritten
    updated_show = await db_session.get(Show, original_id)
    assert updated_show.title == "Custom User Edited Title"

    # Check catalogue was NOT regenerated and no duplicate publish runs
    current_cat = await temp_storage.read("catalogue.json")
    assert current_cat == original_cat

    runs = (await db_session.execute(select(PublishRun))).scalars().all()
    assert len(runs) == 1


@pytest.mark.asyncio
async def test_existing_db_deleted_item_not_restored_on_restart(
    db_session: AsyncSession, temp_storage: LocalStorage
):
    # Fresh bootstrap
    await db_session.execute(User.__table__.delete())
    await db_session.execute(Show.__table__.delete())
    await db_session.commit()

    await run_bootstrap(db_session, temp_storage)

    # Delete a show
    stmt = select(Show).limit(1)
    show = (await db_session.execute(stmt)).scalars().first()
    deleted_slug = show.slug
    await db_session.delete(show)
    await db_session.commit()

    # Restart bootstrap
    result = await run_bootstrap(db_session, temp_storage)
    assert result["is_fresh_db"] is False
    assert result["seeded"] is False

    # Deleted show should NOT be re-created
    re_query = (
        await db_session.execute(select(Show).where(Show.slug == deleted_slug))
    ).scalars().first()
    assert re_query is None


@pytest.mark.asyncio
async def test_normal_cms_publishing_workflow_after_bootstrap(
    client: AsyncClient, db_session: AsyncSession, temp_storage: LocalStorage
):
    # Fresh bootstrap
    await db_session.execute(User.__table__.delete())
    await db_session.execute(Show.__table__.delete())
    await db_session.commit()

    await run_bootstrap(db_session, temp_storage)

    # Login as admin
    login_res = await client.post(
        "/auth/login",
        json={"username": "admin", "password": "adminpassword"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Publish catalog via admin endpoint
    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "success"

    # Verify second publish run recorded
    runs = (
        await db_session.execute(
            select(PublishRun).order_by(PublishRun.id.asc())
        )
    ).scalars().all()
    assert len(runs) == 2
    assert runs[0].triggered_by == "system"
    assert runs[1].triggered_by == "admin"

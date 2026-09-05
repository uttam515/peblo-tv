from datetime import datetime, timedelta, timezone
import io
import json
from unittest.mock import patch
import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PublishRun
from app.storage import get_storage


def create_image_bytes(
    width: int, height: int, format: str = "JPEG", color: str = "blue"
) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


async def get_auth_token(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


async def attach_all_artwork(client: AsyncClient, token: str, ep_id: str):
    headers = {"Authorization": f"Bearer {token}"}
    poster_bytes = create_image_bytes(600, 900, "JPEG")
    banner_bytes = create_image_bytes(1280, 720, "JPEG")
    thumb_bytes = create_image_bytes(640, 360, "JPEG")

    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", poster_bytes, "image/jpeg")},
    )
    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "banner"},
        files={"file": ("banner.jpg", banner_bytes, "image/jpeg")},
    )
    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "thumbnail"},
        files={"file": ("thumb.jpg", thumb_bytes, "image/jpeg")},
    )


@pytest.fixture(autouse=True)
def cleanup_catalogue_file():
    target = get_storage().base_dir / "catalogue.json"
    if target.exists():
        target.unlink()
    yield
    if target.exists():
        target.unlink()



@pytest.mark.asyncio
async def test_unauthenticated_publish_returns_401(client: AsyncClient):
    res = await client.post("/admin/catalog/publish")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_editor_publish_returns_403(client: AsyncClient):
    editor_token = await get_auth_token(client, "editor_user", "editorpass123")
    res = await client.post(
        "/admin/catalog/publish",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_catalog_before_first_publish_returns_404(client: AsyncClient):
    res = await client.get("/catalog")
    assert res.status_code == 404
    assert res.json()["detail"] == "Catalogue has not been published yet"


@pytest.mark.asyncio
async def test_admin_can_publish_valid_catalog_and_get_public_catalog(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "B Show",
            "slug": "b-show",
            "section": "featured",
            "status": "published",
        },
    )
    assert show_res.status_code == 201
    show_id = show_res.json()["id"]

    season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = season_res.json()["id"]

    ep_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_b_1",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "en",
            "content_group": "cg_b_1",
            "duration_seconds": 120,
            "status": "published",
        },
    )
    assert ep_res.status_code == 201
    await attach_all_artwork(client, admin_token, "ep_b_1")

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    data = pub_res.json()
    assert data["status"] == "success"
    assert data["shows_count"] == 1
    assert data["episodes_count"] == 1
    assert data["catalogue_version"] is not None

    storage = get_storage()
    assert await storage.exists("catalogue.json")

    # Public GET /catalog test (no auth header)
    get_res = await client.get("/catalog")
    assert get_res.status_code == 200
    public_catalog = get_res.json()
    assert "sections" in public_catalog
    featured = next(s for s in public_catalog["sections"] if s["name"] == "featured")
    assert len(featured["shows"]) == 1
    assert featured["shows"][0]["slug"] == "b-show"


@pytest.mark.asyncio
async def test_publish_run_records_metadata_correctly(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Run Show", "slug": "run-show", "section": "songs", "status": "published"},
    )
    show_id = show_res.json()["id"]

    s_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1},
    )
    s_id = s_res.json()["id"]

    ep_res = await client.post(
        f"/seasons/{s_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_run_1",
            "episode_number": 1,
            "title": "Song Ep",
            "language": "en",
            "content_group": "cg_run_1",
            "duration_seconds": 90,
            "status": "published",
        },
    )
    assert ep_res.status_code == 201
    await attach_all_artwork(client, admin_token, "ep_run_1")

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    version = pub_data["catalogue_version"]
    assert version.startswith("v_")

    from tests.conftest import test_session_maker
    async with test_session_maker() as session:
        runs = (
            (
                await session.execute(
                    select(PublishRun).order_by(PublishRun.id.desc())
                )
            )
            .scalars()
            .all()
        )
        assert len(runs) >= 1
        latest_run = runs[0]
        assert latest_run.status == "success"
        assert latest_run.triggered_by == "admin_user"
        assert latest_run.started_at is not None
        assert latest_run.completed_at is not None
        assert latest_run.catalogue_version == version
        assert latest_run.shows_count == 1
        assert latest_run.episodes_count == 1


@pytest.mark.asyncio
async def test_failed_validation_does_not_modify_existing_catalogue_and_records_failed_run(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Publish valid show 1
    show1 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Show 1", "slug": "show-1", "section": "featured", "status": "published"},
    )
    s1 = await client.post(f"/shows/{show1.json()['id']}/seasons", headers=headers, json={"season_number": 1})
    ep1 = await client.post(
        f"/seasons/{s1.json()['id']}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_valid_1",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "en",
            "content_group": "cg_v1",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_valid_1")

    res1 = await client.post("/admin/catalog/publish", headers=headers)
    assert res1.status_code == 200
    initial_catalog_bytes = await get_storage().read("catalogue.json")

    # 2. Add invalid published show (no section)
    await client.post(
        "/shows",
        headers=headers,
        json={"title": "Invalid Show", "slug": "invalid-show", "status": "published"},
    )

    # 3. Attempt publish -> fails validation
    res2 = await client.post("/admin/catalog/publish", headers=headers)
    assert res2.status_code == 422

    # 4. Verify existing catalogue.json is intact
    current_catalog_bytes = await get_storage().read("catalogue.json")
    assert current_catalog_bytes == initial_catalog_bytes

    # 5. Verify failed run was recorded
    from tests.conftest import test_session_maker
    async with test_session_maker() as session:
        runs = (
            (
                await session.execute(
                    select(PublishRun).order_by(PublishRun.id.desc())
                )
            )
            .scalars()
            .all()
        )
        latest_run = runs[0]
        assert latest_run.status == "failed"
        assert latest_run.triggered_by == "admin_user"
        assert "Validation failed" in latest_run.summary


@pytest.mark.asyncio
async def test_simulated_write_failure_does_not_modify_existing_catalogue(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Publish valid initial catalogue
    show = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Init Show", "slug": "init-show", "section": "series", "status": "published"},
    )
    s = await client.post(f"/shows/{show.json()['id']}/seasons", headers=headers, json={"season_number": 1})
    await client.post(
        f"/seasons/{s.json()['id']}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_init_1",
            "episode_number": 1,
            "title": "Init Ep",
            "language": "en",
            "content_group": "cg_init_1",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_init_1")

    res1 = await client.post("/admin/catalog/publish", headers=headers)
    assert res1.status_code == 200
    initial_content = await get_storage().read("catalogue.json")

    # Add second valid episode
    await client.post(
        f"/seasons/{s.json()['id']}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_init_2",
            "episode_number": 2,
            "title": "Init Ep 2",
            "language": "en",
            "content_group": "cg_init_2",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_init_2")

    # Mock save_atomic to fail during temporary file write
    async def mock_save_atomic(*args, **kwargs):
        raise IOError("Simulated disk write failure")

    with patch.object(get_storage().__class__, "save_atomic", side_effect=mock_save_atomic):
        with pytest.raises(IOError, match="Simulated disk write failure"):
            await client.post("/admin/catalog/publish", headers=headers)

    # Verify existing catalogue.json is intact
    post_failure_content = await get_storage().read("catalogue.json")
    assert post_failure_content == initial_content


@pytest.mark.asyncio
async def test_successful_publish_replaces_catalogue_atomically(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Publish version 1
    show = await client.post(
        "/shows",
        headers=headers,
        json={"title": "V1 Show", "slug": "v1-show", "section": "minisodes", "status": "published"},
    )
    s = await client.post(f"/shows/{show.json()['id']}/seasons", headers=headers, json={"season_number": 1})
    await client.post(
        f"/seasons/{s.json()['id']}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_v1",
            "episode_number": 1,
            "title": "V1 Ep",
            "language": "en",
            "content_group": "cg_v1",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_v1")

    res1 = await client.post("/admin/catalog/publish", headers=headers)
    assert res1.status_code == 200

    cat1_res = await client.get("/catalog")
    cat1_shows = cat1_res.json()["sections"][2]["shows"]
    assert len(cat1_shows) == 1
    assert cat1_shows[0]["title"] == "V1 Show"

    # Update show title to V2 Show and re-publish
    await client.patch(f"/shows/{show.json()['id']}", headers=headers, json={"title": "V2 Show"})

    res2 = await client.post("/admin/catalog/publish", headers=headers)
    assert res2.status_code == 200

    cat2_res = await client.get("/catalog")
    cat2_shows = cat2_res.json()["sections"][2]["shows"]
    assert len(cat2_shows) == 1
    assert cat2_shows[0]["title"] == "V2 Show"


@pytest.mark.asyncio
async def test_published_show_without_valid_section_fails_validation(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "No Section Show", "slug": "no-sec-show", "status": "published"},
    )
    assert show_res.status_code == 201

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 422
    err_detail = pub_res.json()["detail"]
    assert "errors" in err_detail
    assert any(
        e["entity_type"] == "show" and "section" in e["error"]
        for e in err_detail["errors"]
    )


@pytest.mark.asyncio
async def test_published_episode_without_duration_fails_validation(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Show Ep Duration",
            "slug": "show-ep-dur",
            "section": "series",
            "status": "published",
        },
    )
    show_id = show_res.json()["id"]

    season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = season_res.json()["id"]

    ep_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_dur_test",
            "episode_number": 1,
            "title": "Ep Duration Test",
            "language": "en",
            "content_group": "cg_dur_test",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    assert ep_res.status_code == 201
    await attach_all_artwork(client, admin_token, "ep_dur_test")

    await client.patch(
        "/episodes/ep_dur_test",
        headers=headers,
        json={"duration_seconds": 0},
    )

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 422
    err_detail = pub_res.json()["detail"]
    assert any(
        e["entity_type"] == "episode" and "duration_seconds" in e["error"]
        for e in err_detail["errors"]
    )


@pytest.mark.asyncio
async def test_published_episode_missing_artwork_fails_validation(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Show Missing Art",
            "slug": "show-missing-art",
            "section": "series",
            "status": "published",
        },
    )
    show_id = show_res.json()["id"]

    season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = season_res.json()["id"]

    ep_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_missing_art",
            "episode_number": 1,
            "title": "Ep Missing Art",
            "language": "en",
            "content_group": "cg_missing_art",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    assert ep_res.status_code == 201

    # 1. Missing all artwork
    pub_res1 = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res1.status_code == 422
    errors1 = pub_res1.json()["detail"]["errors"]
    assert any("missing poster" in e["error"] for e in errors1)
    assert any("missing banner" in e["error"] for e in errors1)
    assert any("missing thumbnail" in e["error"] for e in errors1)

    # 2. Attach poster only -> missing banner and thumbnail
    poster_bytes = create_image_bytes(600, 900, "JPEG")
    await client.post(
        "/episodes/ep_missing_art/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", poster_bytes, "image/jpeg")},
    )

    pub_res2 = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res2.status_code == 422
    errors2 = pub_res2.json()["detail"]["errors"]
    assert not any("missing poster" in e["error"] for e in errors2)
    assert any("missing banner" in e["error"] for e in errors2)
    assert any("missing thumbnail" in e["error"] for e in errors2)

    # 3. Attach banner -> missing thumbnail only
    banner_bytes = create_image_bytes(1280, 720, "JPEG")
    await client.post(
        "/episodes/ep_missing_art/artwork",
        headers=headers,
        data={"artwork_type": "banner"},
        files={"file": ("banner.jpg", banner_bytes, "image/jpeg")},
    )

    pub_res3 = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res3.status_code == 422
    errors3 = pub_res3.json()["detail"]["errors"]
    assert any("missing thumbnail" in e["error"] for e in errors3)


@pytest.mark.asyncio
async def test_draft_shows_and_episodes_are_excluded(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Draft show with draft episode
    draft_show = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Draft Show", "slug": "draft-show", "section": "series", "status": "draft"},
    )
    draft_show_id = draft_show.json()["id"]
    s_res = await client.post(
        f"/shows/{draft_show_id}/seasons",
        headers=headers,
        json={"season_number": 1},
    )
    s_id = s_res.json()["id"]
    await client.post(
        f"/seasons/{s_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_draft_1",
            "episode_number": 1,
            "title": "Draft Ep",
            "language": "en",
            "content_group": "cg_draft_1",
            "status": "draft",
        },
    )

    # Published show with 1 published episode and 1 draft episode
    pub_show = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Pub Show", "slug": "pub-show", "section": "series", "status": "published"},
    )
    pub_show_id = pub_show.json()["id"]
    s2_res = await client.post(
        f"/shows/{pub_show_id}/seasons",
        headers=headers,
        json={"season_number": 1},
    )
    s2_id = s2_res.json()["id"]

    await client.post(
        f"/seasons/{s2_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_pub_ok",
            "episode_number": 1,
            "title": "Pub Ep",
            "language": "en",
            "content_group": "cg_pub_ok",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_pub_ok")

    await client.post(
        f"/seasons/{s2_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_draft_ignored",
            "episode_number": 2,
            "title": "Draft Ignored",
            "language": "en",
            "content_group": "cg_draft_ignored",
            "status": "draft",
        },
    )

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    catalog = pub_res.json()["catalog"]

    series_section = next(s for s in catalog["sections"] if s["name"] == "series")
    show_slugs = [s["slug"] for s in series_section["shows"]]
    assert "draft-show" not in show_slugs
    assert "pub-show" in show_slugs

    published_show_entry = next(s for s in series_section["shows"] if s["slug"] == "pub-show")
    episodes = published_show_entry["seasons"][0]["episodes"]
    assert len(episodes) == 1
    assert episodes[0]["content_group"] == "cg_pub_ok"


@pytest.mark.asyncio
async def test_content_group_collapses_and_canonical_language_selection(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Language Show",
            "slug": "lang-show",
            "section": "series",
            "status": "published",
        },
    )
    show_id = show_res.json()["id"]

    season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1},
    )
    season_id = season_res.json()["id"]

    # 1. Pair with English and Hindi (English should be canonical)
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_en_1",
            "episode_number": 1,
            "title": "English Title Ep 1",
            "synopsis": "English Synopsis",
            "language": "en",
            "content_group": "cg_multilang_1",
            "duration_seconds": 150,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_en_1")

    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_hi_1",
            "episode_number": 1,
            "title": "Hindi Title Ep 1",
            "synopsis": "Hindi Synopsis",
            "language": "hi",
            "content_group": "cg_multilang_1",
            "duration_seconds": 150,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_hi_1")

    # 2. Single Hindi episode (fallback canonical when English unavailable)
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_hi_only",
            "episode_number": 2,
            "title": "Hindi Only Ep 2",
            "synopsis": "Hindi Only Synopsis",
            "language": "hi",
            "content_group": "cg_hi_only",
            "duration_seconds": 200,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_hi_only")

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    catalog = pub_res.json()["catalog"]

    series_section = next(s for s in catalog["sections"] if s["name"] == "series")
    show = next(s for s in series_section["shows"] if s["slug"] == "lang-show")
    episodes = show["seasons"][0]["episodes"]

    assert len(episodes) == 2

    # Episode 1 collapsed
    ep1 = episodes[0]
    assert ep1["content_group"] == "cg_multilang_1"
    assert ep1["languages"] == ["en", "hi"]
    assert ep1["title"] == "English Title Ep 1"

    # Episode 2 fallback
    ep2 = episodes[1]
    assert ep2["content_group"] == "cg_hi_only"
    assert ep2["languages"] == ["hi"]
    assert ep2["title"] == "Hindi Only Ep 2"


@pytest.mark.asyncio
async def test_season_zero_excluded_from_normal_catalogue(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Trailer Show",
            "slug": "trailer-show",
            "section": "series",
            "status": "published",
        },
    )
    show_id = show_res.json()["id"]

    # Season 0
    s0_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 0, "title": "Trailers"},
    )
    s0_id = s0_res.json()["id"]

    # Season 1
    s1_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    s1_id = s1_res.json()["id"]

    await client.post(
        f"/seasons/{s1_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_s1_1",
            "episode_number": 1,
            "title": "S1 Ep 1",
            "language": "en",
            "content_group": "cg_s1_1",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_s1_1")

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    catalog = pub_res.json()["catalog"]

    series_section = next(s for s in catalog["sections"] if s["name"] == "series")
    show = next(s for s in series_section["shows"] if s["slug"] == "trailer-show")
    season_numbers = [s["season_number"] for s in show["seasons"]]
    assert 0 not in season_numbers
    assert 1 in season_numbers


@pytest.mark.asyncio
async def test_deterministic_ordering_sections_shows_seasons_episodes(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    for sec, title, slug in [
        ("songs", "Song Show", "song-show"),
        ("featured", "Zebra Show", "zebra-show"),
        ("featured", "Apple Show", "apple-show"),
        ("minisodes", "Mini Show", "mini-show"),
    ]:
        s = await client.post(
            "/shows",
            headers=headers,
            json={"title": title, "slug": slug, "section": sec, "status": "published"},
        )
        s_id = s.json()["id"]
        for s_num in [2, 1]:
            season_res = await client.post(
                f"/shows/{s_id}/seasons",
                headers=headers,
                json={"season_number": s_num},
            )
            season_id = season_res.json()["id"]
            for ep_num in [3, 1]:
                ep_id = f"ep_{slug}_{s_num}_{ep_num}"
                await client.post(
                    f"/seasons/{season_id}/episodes",
                    headers=headers,
                    json={
                        "episode_id": ep_id,
                        "episode_number": ep_num,
                        "title": f"Ep {ep_num}",
                        "language": "en",
                        "content_group": f"cg_{slug}_{s_num}_{ep_num}",
                        "duration_seconds": 100,
                        "status": "published",
                    },
                )
                await attach_all_artwork(client, admin_token, ep_id)

    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200
    catalog = pub_res.json()["catalog"]

    section_names = [s["name"] for s in catalog["sections"]]
    assert section_names == ["featured", "series", "minisodes", "songs"]

    featured_shows = next(s for s in catalog["sections"] if s["name"] == "featured")[
        "shows"
    ]
    assert [sh["title"] for sh in featured_shows] == ["Apple Show", "Zebra Show"]

    seasons = featured_shows[0]["seasons"]
    assert [sn["season_number"] for sn in seasons] == [1, 2]

    episodes = seasons[0]["episodes"]
    assert [e["episode_number"] for e in episodes] == [1, 3]


@pytest.mark.asyncio
async def test_admin_can_retrieve_publish_history(
    client: AsyncClient,
    db_session: AsyncSession,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Perform a publish (validation failure on empty or valid content)
    await client.post("/admin/catalog/publish", headers=headers)

    res = await client.get("/admin/catalog/history", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    run = data[0]
    assert "id" in run
    assert "triggered_by" in run
    assert "status" in run
    assert "started_at" in run
    assert "completed_at" in run
    assert "catalogue_version" in run
    assert "shows_count" in run
    assert "episodes_count" in run
    assert "summary" in run
    assert run["triggered_by"] == "admin_user"


@pytest.mark.asyncio
async def test_editor_cannot_retrieve_publish_history(
    client: AsyncClient,
):
    editor_token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {editor_token}"}

    res = await client.get("/admin/catalog/history", headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_publish_history_ordering_newest_first_and_fields(
    client: AsyncClient,
    db_session: AsyncSession,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create distinct publish run records
    now = datetime.now(timezone.utc)
    run1 = PublishRun(
        triggered_by="admin_user",
        status="success",
        shows_count=2,
        episodes_count=5,
        catalogue_version="v_20260101000000",
        started_at=now - timedelta(minutes=10),
        completed_at=now - timedelta(minutes=9),
        summary="Run 1",
    )
    run2 = PublishRun(
        triggered_by="admin_user",
        status="failed",
        shows_count=0,
        episodes_count=0,
        catalogue_version=None,
        started_at=now - timedelta(minutes=5),
        completed_at=now - timedelta(minutes=4),
        summary="Run 2",
    )
    run3 = PublishRun(
        triggered_by="admin_user",
        status="success",
        shows_count=3,
        episodes_count=7,
        catalogue_version="v_20260101001000",
        started_at=now,
        completed_at=now,
        summary="Run 3",
    )
    db_session.add_all([run1, run2, run3])
    await db_session.commit()

    res = await client.get("/admin/catalog/history?limit=10", headers=headers)
    assert res.status_code == 200
    runs = res.json()
    assert len(runs) >= 3

    # Newest run first
    summaries = [r["summary"] for r in runs if r["summary"] in ["Run 1", "Run 2", "Run 3"]]
    assert summaries == ["Run 3", "Run 2", "Run 1"]


@pytest.mark.asyncio
async def test_catalog_status_endpoint_states_and_draft_isolation(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    editor_token = await get_auth_token(client, "editor_user", "editorpass123")
    editor_headers = {"Authorization": f"Bearer {editor_token}"}

    # 1. State: no_catalogue when no publish has succeeded
    status_res = await client.get("/admin/catalog/status", headers=editor_headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] == "no_catalogue"
    assert status_data["catalogue_version"] is None

    # 2. Create and publish a show with an episode + artwork
    show_res = await client.post(
        "/shows",
        headers=admin_headers,
        json={"title": "Status Show", "slug": "status-show", "section": "featured", "status": "published"},
    )
    show_id = show_res.json()["id"]

    sea_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=admin_headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = sea_res.json()["id"]

    ep_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=admin_headers,
        json={
            "episode_id": "status-ep-1",
            "episode_number": 1,
            "title": "Status Ep 1",
            "content_group": "cg-status-1",
            "language": "en",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    assert ep_res.status_code == 201

    await attach_all_artwork(client, admin_token, "status-ep-1")

    # Deploy live catalogue
    pub_res = await client.post("/admin/catalog/publish", headers=admin_headers)
    assert pub_res.status_code == 200

    # 3. State: catalogue live
    status_res2 = await client.get("/admin/catalog/status", headers=editor_headers)
    assert status_res2.status_code == 200
    assert status_res2.json()["status"] == "live"
    assert status_res2.json()["catalogue_version"] is not None

    # 4. Draft-only isolation: editing an unrelated draft show/episode must NOT cause changes_pending
    draft_show_res = await client.post(
        "/shows",
        headers=editor_headers,
        json={"title": "Draft Only Show", "slug": "draft-only-show", "section": "series", "status": "draft"},
    )
    draft_show_id = draft_show_res.json()["id"]

    status_res3 = await client.get("/admin/catalog/status", headers=editor_headers)
    assert status_res3.json()["status"] == "live"  # Still live! No false positive!

    # 5. Modifying a published show MUST trigger changes_pending
    await client.patch(
        f"/shows/{show_id}",
        headers=editor_headers,
        json={"title": "Status Show Renamed"},
    )
    status_res4 = await client.get("/admin/catalog/status", headers=editor_headers)
    assert status_res4.json()["status"] == "changes_pending"


@pytest.mark.asyncio
async def test_catalog_status_episode_counts_distinguishes_records_and_unique_content_groups(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Multi Lang Show", "slug": "multi-lang-show", "section": "featured", "status": "published"},
    )
    show_id = show_res.json()["id"]

    sea_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = sea_res.json()["id"]

    # Add English episode
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ml-ep-1-en",
            "episode_number": 1,
            "title": "Ep 1 EN",
            "content_group": "cg-multi-1",
            "language": "en",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ml-ep-1-en")

    # Add Hindi variant of the SAME content_group
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ml-ep-1-hi",
            "episode_number": 1,
            "title": "Ep 1 HI",
            "content_group": "cg-multi-1",
            "language": "hi",
            "duration_seconds": 100,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ml-ep-1-hi")

    # Add distinct episode
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ml-ep-2-en",
            "episode_number": 2,
            "title": "Ep 2 EN",
            "content_group": "cg-multi-2",
            "language": "en",
            "duration_seconds": 100,
            "status": "draft",
        },
    )

    status_res = await client.get("/admin/catalog/status", headers=headers)
    assert status_res.status_code == 200
    data = status_res.json()
    ep_counts = data["episodes_count"]

    # 3 records in DB (ml-ep-1-en, ml-ep-1-hi, ml-ep-2-en)
    assert ep_counts["total"] >= 3
    # 2 distinct content groups (cg-multi-1, cg-multi-2)
    assert ep_counts["unique"] >= 2
    # Distinct content groups is strictly less than total records due to the variant
    assert ep_counts["unique"] < ep_counts["total"]



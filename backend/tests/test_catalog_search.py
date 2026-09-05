import io
import pytest
from httpx import AsyncClient
from PIL import Image
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


async def setup_multi_show_catalog(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Show 1: Adventure Animals in "series", category "adventure"
    s1 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Adventure Animals", "slug": "adv-animals", "section": "series", "status": "published"},
    )
    s1_id = s1.json()["id"]
    sea1 = await client.post(f"/shows/{s1_id}/seasons", headers=headers, json={"season_number": 1})
    sea1_id = sea1.json()["id"]

    # Episode 1 in Show 1 (English and Hindi)
    await client.post(
        f"/seasons/{sea1_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_adv_1_en",
            "episode_number": 1,
            "title": "Brave Lion",
            "language": "en",
            "content_group": "cg_adv_1",
            "duration_seconds": 120,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_adv_1_en")
    await client.post(
        f"/seasons/{sea1_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_adv_1_hi",
            "episode_number": 1,
            "title": "Sher Bahdur",
            "language": "hi",
            "content_group": "cg_adv_1",
            "duration_seconds": 120,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_adv_1_hi")

    # Episode 2 in Show 1 (English only)
    await client.post(
        f"/seasons/{sea1_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_adv_2_en",
            "episode_number": 2,
            "title": "Clever Monkey",
            "language": "en",
            "content_group": "cg_adv_2",
            "duration_seconds": 140,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_adv_2_en")

    # Show 2: Folk Melodies in "songs", category "folk" & "music"
    s2 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Folk Melodies", "slug": "folk-melodies", "section": "songs", "status": "published"},
    )
    s2_id = s2.json()["id"]
    sea2 = await client.post(f"/shows/{s2_id}/seasons", headers=headers, json={"season_number": 1})
    sea2_id = sea2.json()["id"]

    # Episode 1 in Show 2 (Hindi only)
    await client.post(
        f"/seasons/{sea2_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_folk_1_hi",
            "episode_number": 1,
            "title": "Desi Dhun",
            "language": "hi",
            "content_group": "cg_folk_1",
            "duration_seconds": 180,
            "status": "published",
        },
    )
    await attach_all_artwork(client, admin_token, "ep_folk_1_hi")

    # Publish catalog
    pub_res = await client.post("/admin/catalog/publish", headers=headers)
    assert pub_res.status_code == 200


@pytest.mark.asyncio
async def test_search_before_publish_returns_404(client: AsyncClient):
    res = await client.get("/catalog/search?q=lion")
    assert res.status_code == 404
    assert res.json()["detail"] == "Catalogue has not been published yet"


@pytest.mark.asyncio
async def test_search_is_public_and_empty_filter_returns_full_catalog(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    res = await client.get("/catalog/search")
    assert res.status_code == 200
    data = res.json()
    assert "sections" in data
    assert len(data["sections"]) == 4


@pytest.mark.asyncio
async def test_search_q_matches_show_title_case_insensitive(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    # Search partial and case-insensitive
    res = await client.get("/catalog/search?q=  ADVENTURE  ")
    assert res.status_code == 200
    data = res.json()

    series = next(s for s in data["sections"] if s["name"] == "series")
    assert len(series["shows"]) == 1
    assert series["shows"][0]["slug"] == "adv-animals"

    songs = next(s for s in data["sections"] if s["name"] == "songs")
    assert len(songs["shows"]) == 0


@pytest.mark.asyncio
async def test_search_q_matches_episode_title_and_filters_episodes(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    # Search for "Clever" which is only Episode 2 of Adventure Animals
    res = await client.get("/catalog/search?q=clever")
    assert res.status_code == 200
    data = res.json()

    series = next(s for s in data["sections"] if s["name"] == "series")
    assert len(series["shows"]) == 1
    episodes = series["shows"][0]["seasons"][0]["episodes"]
    assert len(episodes) == 1
    assert episodes[0]["title"] == "Clever Monkey"
    assert episodes[0]["content_group"] == "cg_adv_2"


@pytest.mark.asyncio
async def test_search_by_language_filter(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    # Search language "hi"
    res = await client.get("/catalog/search?language=HI")
    assert res.status_code == 200
    data = res.json()

    # Show 1 has 1 Hindi episode (cg_adv_1); cg_adv_2 is English only so excluded
    series = next(s for s in data["sections"] if s["name"] == "series")
    assert len(series["shows"]) == 1
    episodes = series["shows"][0]["seasons"][0]["episodes"]
    assert len(episodes) == 1
    assert episodes[0]["content_group"] == "cg_adv_1"

    # Show 2 has 1 Hindi episode
    songs = next(s for s in data["sections"] if s["name"] == "songs")
    assert len(songs["shows"]) == 1
    assert songs["shows"][0]["slug"] == "folk-melodies"


@pytest.mark.asyncio
async def test_search_by_section_filter(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    res = await client.get("/catalog/search?section=songs")
    assert res.status_code == 200
    data = res.json()

    # Only songs section returned
    assert len(data["sections"]) == 1
    assert data["sections"][0]["name"] == "songs"
    assert len(data["sections"][0]["shows"]) == 1


@pytest.mark.asyncio
async def test_multiple_filters_compose(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    # 1. Matches: section=series, language=hi, q=lion
    res1 = await client.get("/catalog/search?section=series&language=hi&q=lion")
    assert res1.status_code == 200
    shows1 = res1.json()["sections"][0]["shows"]
    assert len(shows1) == 1
    assert shows1[0]["slug"] == "adv-animals"

    # 2. No match: section=songs, language=en
    res2 = await client.get("/catalog/search?section=songs&language=en")
    assert res2.status_code == 200
    shows2 = res2.json()["sections"][0]["shows"]
    assert len(shows2) == 0


@pytest.mark.asyncio
async def test_search_no_results_returns_empty_structure(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    res = await client.get("/catalog/search?q=nonexistentqueryxyz")
    assert res.status_code == 200
    data = res.json()
    assert "sections" in data
    for sec in data["sections"]:
        assert len(sec["shows"]) == 0


@pytest.mark.asyncio
async def test_search_does_not_expose_duplicate_language_variants(
    client: AsyncClient,
):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    res = await client.get("/catalog/search?q=lion")
    assert res.status_code == 200
    series = next(s for s in res.json()["sections"] if s["name"] == "series")
    episodes = series["shows"][0]["seasons"][0]["episodes"]

    # Even though both en and hi variants exist in the DB, only 1 collapsed episode is returned
    assert len(episodes) == 1
    assert episodes[0]["content_group"] == "cg_adv_1"
    assert episodes[0]["languages"] == ["en", "hi"]


@pytest.mark.asyncio
async def test_search_deterministic_ordering(client: AsyncClient):
    admin_token = await get_auth_token(client, "admin_user", "adminpass123")
    await setup_multi_show_catalog(client, admin_token)

    res = await client.get("/catalog/search")
    assert res.status_code == 200
    section_names = [s["name"] for s in res.json()["sections"]]
    assert section_names == ["featured", "series", "minisodes", "songs"]

import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_unauthenticated_requests_return_401(client: AsyncClient):
    assert (await client.get("/shows")).status_code == 401
    assert (await client.get("/shows/1")).status_code == 401
    assert (await client.post("/shows", json={"title": "T", "slug": "s"})).status_code == 401
    assert (await client.patch("/shows/1", json={"title": "T"})).status_code == 401
    assert (await client.delete("/shows/1")).status_code == 401


@pytest.mark.asyncio
async def test_editor_can_create_update_delete_show(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Editor Show",
            "slug": "editor-show",
            "section": "featured",
            "description": "Show created by editor",
            "status": "draft",
        },
    )
    assert create_res.status_code == 201
    show_data = create_res.json()
    show_id = show_data["id"]
    assert show_data["title"] == "Editor Show"
    assert show_data["slug"] == "editor-show"
    assert show_data["section"] == "featured"
    assert show_data["status"] == "draft"
    assert show_data["categories"] == []

    update_res = await client.patch(
        f"/shows/{show_id}",
        headers=headers,
        json={"title": "Updated Editor Show", "status": "published"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Editor Show"
    assert update_res.json()["status"] == "published"

    delete_res = await client.delete(f"/shows/{show_id}", headers=headers)
    assert delete_res.status_code == 204

    get_res = await client.get(f"/shows/{show_id}", headers=headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_create_update_delete_show(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post(
        "/shows",
        headers=headers,
        json={
            "title": "Admin Show",
            "slug": "admin-show",
            "section": "series",
            "status": "published",
        },
    )
    assert create_res.status_code == 201
    show_id = create_res.json()["id"]

    update_res = await client.patch(
        f"/shows/{show_id}",
        headers=headers,
        json={"description": "Admin updated description"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Admin updated description"

    delete_res = await client.delete(f"/shows/{show_id}", headers=headers)
    assert delete_res.status_code == 204


@pytest.mark.asyncio
async def test_create_duplicate_slug_returns_409(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    res1 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Show One", "slug": "duplicate-slug"},
    )
    assert res1.status_code == 201

    res2 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Show Two", "slug": "duplicate-slug"},
    )
    assert res2.status_code == 409
    assert res2.json()["detail"] == "Show with this slug already exists"


@pytest.mark.asyncio
async def test_update_duplicate_slug_returns_409(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    res1 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "First Show", "slug": "slug-alpha"},
    )
    assert res1.status_code == 201

    res2 = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Second Show", "slug": "slug-beta"},
    )
    assert res2.status_code == 201
    show2_id = res2.json()["id"]

    patch_conflict = await client.patch(
        f"/shows/{show2_id}",
        headers=headers,
        json={"slug": "slug-alpha"},
    )
    assert patch_conflict.status_code == 409
    assert patch_conflict.json()["detail"] == "Show with this slug already exists"


@pytest.mark.asyncio
async def test_invalid_section_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Invalid Section Show", "slug": "inv-sec", "section": "movies"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_invalid_status_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Invalid Status Show", "slug": "inv-stat", "status": "archived"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_get_show_by_id(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Get By ID Show", "slug": "get-by-id-show", "section": "songs"},
    )
    show_id = create_res.json()["id"]

    get_res = await client.get(f"/shows/{show_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == show_id
    assert get_res.json()["title"] == "Get By ID Show"
    assert get_res.json()["categories"] == []

    not_found_res = await client.get("/shows/99999", headers=headers)
    assert not_found_res.status_code == 404
    assert not_found_res.json()["detail"] == "Show not found"


@pytest.mark.asyncio
async def test_list_search_filter_and_pagination(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    shows = [
        {"title": "Moti Adventures", "slug": "moti-adv", "section": "featured", "status": "published"},
        {"title": "Banyan Tales", "slug": "banyan-tales", "section": "series", "status": "published"},
        {"title": "Moti Learning", "slug": "moti-learn", "section": "minisodes", "status": "draft"},
        {"title": "Peblo Songs", "slug": "peblo-songs-test", "section": "songs", "status": "published"},
        {"title": "Rhyme Rangers", "slug": "rhyme-rangers-test", "section": None, "status": "draft"},
    ]

    for s in shows:
        res = await client.post("/shows", headers=headers, json=s)
        assert res.status_code == 201

    search_res = await client.get("/shows?q=Moti", headers=headers)
    assert search_res.status_code == 200
    assert search_res.json()["total"] == 2

    sec_res = await client.get("/shows?section=featured", headers=headers)
    assert sec_res.status_code == 200
    assert sec_res.json()["total"] == 1
    assert sec_res.json()["results"][0]["slug"] == "moti-adv"

    stat_res = await client.get("/shows?status=draft", headers=headers)
    assert stat_res.status_code == 200
    assert stat_res.json()["total"] == 2

    page_1 = await client.get("/shows?page=1&page_size=2", headers=headers)
    assert page_1.status_code == 200
    assert page_1.json()["total"] == 5
    assert len(page_1.json()["results"]) == 2

    page_3 = await client.get("/shows?page=3&page_size=2", headers=headers)
    assert page_3.status_code == 200
    assert page_3.json()["total"] == 5
    assert len(page_3.json()["results"]) == 1


@pytest.mark.asyncio
async def test_delete_nonexistent_show_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.delete("/shows/99999", headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Show not found"


@pytest.mark.asyncio
async def test_editor_and_admin_can_publish_series(client: AsyncClient):
    editor_token = await get_auth_token(client, "editor_user", "editorpass123")
    editor_headers = {"Authorization": f"Bearer {editor_token}"}

    # 1. Create a draft show with seasons and episodes
    create_show_res = await client.post(
        "/shows",
        headers=editor_headers,
        json={"title": "Draft Series", "slug": "draft-series", "section": "series", "status": "draft"},
    )
    assert create_show_res.status_code == 201
    show_id = create_show_res.json()["id"]

    create_season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=editor_headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    assert create_season_res.status_code == 201
    season_id = create_season_res.json()["id"]

    # Create 2 draft episodes with duration
    ep1_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=editor_headers,
        json={
            "episode_id": "ds-ep-1",
            "episode_number": 1,
            "title": "Ep 1",
            "content_group": "cg-ds-1",
            "language": "en",
            "duration_seconds": 120,
            "status": "draft",
        },
    )
    assert ep1_res.status_code == 201

    ep2_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=editor_headers,
        json={
            "episode_id": "ds-ep-2",
            "episode_number": 2,
            "title": "Ep 2",
            "content_group": "cg-ds-2",
            "language": "en",
            "duration_seconds": 180,
            "status": "draft",
        },
    )
    assert ep2_res.status_code == 201

    # Editor publishes series
    pub_res = await client.post(f"/shows/{show_id}/publish", headers=editor_headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["show_id"] == show_id
    assert pub_data["show_status"] == "published"
    assert pub_data["episodes_published_count"] == 2

    # Verify show is published
    show_check = await client.get(f"/shows/{show_id}", headers=editor_headers)
    assert show_check.json()["status"] == "published"

    # Verify episodes are published
    eps_check = await client.get(f"/seasons/{season_id}/episodes", headers=editor_headers)
    assert all(e["status"] == "published" for e in eps_check.json())


@pytest.mark.asyncio
async def test_publish_series_missing_duration_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    create_show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Invalid Series", "slug": "inv-series", "section": "series", "status": "draft"},
    )
    show_id = create_show_res.json()["id"]

    create_season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = create_season_res.json()["id"]

    # Draft episode with missing duration
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "inv-ep-1",
            "episode_number": 1,
            "title": "Ep No Duration",
            "content_group": "cg-inv-1",
            "language": "en",
            "duration_seconds": None,
            "status": "draft",
        },
    )

    pub_res = await client.post(f"/shows/{show_id}/publish", headers=headers)
    assert pub_res.status_code == 422
    assert "missing duration_seconds" in str(pub_res.json())


@pytest.mark.asyncio
async def test_update_published_show_to_draft_cascades_episodes_to_draft(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    # Create published show with published episodes
    create_show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Series Cascade Test", "slug": "cascade-test", "section": "series", "status": "published"},
    )
    assert create_show_res.status_code == 201
    show_id = create_show_res.json()["id"]

    create_season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    season_id = create_season_res.json()["id"]

    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "casc-ep-1",
            "episode_number": 1,
            "title": "Cascade Ep 1",
            "content_group": "cg-casc-1",
            "language": "en",
            "duration_seconds": 120,
            "status": "published",
        },
    )
    await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "casc-ep-2",
            "episode_number": 2,
            "title": "Cascade Ep 2",
            "content_group": "cg-casc-2",
            "language": "en",
            "duration_seconds": 150,
            "status": "published",
        },
    )

    # Verify both episodes are published
    eps_before = await client.get(f"/seasons/{season_id}/episodes", headers=headers)
    assert len(eps_before.json()) == 2
    assert all(e["status"] == "published" for e in eps_before.json())

    # Update show to draft
    patch_res = await client.patch(
        f"/shows/{show_id}",
        headers=headers,
        json={"status": "draft"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "draft"

    # Verify that all episodes of this show have cascaded to draft
    eps_after = await client.get(f"/seasons/{season_id}/episodes", headers=headers)
    assert len(eps_after.json()) == 2
    assert all(e["status"] == "draft" for e in eps_after.json())


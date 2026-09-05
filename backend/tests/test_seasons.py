import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


async def create_test_show(client: AsyncClient, token: str, slug: str = "test-show") -> int:
    headers = {"Authorization": f"Bearer {token}"}
    res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Test Show", "slug": slug, "section": "series"},
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_unauthenticated_requests_return_401(client: AsyncClient):
    assert (await client.get("/shows/1/seasons")).status_code == 401
    assert (await client.post("/shows/1/seasons", json={"season_number": 1})).status_code == 401
    assert (await client.get("/seasons/1")).status_code == 401
    assert (await client.patch("/seasons/1", json={"title": "T"})).status_code == 401
    assert (await client.delete("/seasons/1")).status_code == 401


@pytest.mark.asyncio
async def test_editor_can_create_update_delete_season(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="editor-season-show")

    create_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season One"},
    )
    assert create_res.status_code == 201
    season_data = create_res.json()
    season_id = season_data["id"]
    assert season_data["show_id"] == show_id
    assert season_data["season_number"] == 1
    assert season_data["title"] == "Season One"

    update_res = await client.patch(
        f"/seasons/{season_id}",
        headers=headers,
        json={"title": "Updated Season One"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Season One"

    delete_res = await client.delete(f"/seasons/{season_id}", headers=headers)
    assert delete_res.status_code == 204

    get_res = await client.get(f"/seasons/{season_id}", headers=headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_create_update_delete_season(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="admin-season-show")

    create_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Admin Season 1"},
    )
    assert create_res.status_code == 201
    season_id = create_res.json()["id"]

    update_res = await client.patch(
        f"/seasons/{season_id}",
        headers=headers,
        json={"title": "Admin updated title"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Admin updated title"

    delete_res = await client.delete(f"/seasons/{season_id}", headers=headers)
    assert delete_res.status_code == 204


@pytest.mark.asyncio
async def test_nonexistent_show_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    get_res = await client.get("/shows/99999/seasons", headers=headers)
    assert get_res.status_code == 404
    assert get_res.json()["detail"] == "Show not found"

    post_res = await client.post(
        "/shows/99999/seasons",
        headers=headers,
        json={"season_number": 1},
    )
    assert post_res.status_code == 404
    assert post_res.json()["detail"] == "Show not found"


@pytest.mark.asyncio
async def test_nonexistent_season_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.get("/seasons/99999", headers=headers)).status_code == 404
    assert (await client.patch("/seasons/99999", headers=headers, json={"title": "T"})).status_code == 404
    assert (await client.delete("/seasons/99999", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_duplicate_season_number_returns_409(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="dupe-season-show")

    res1 = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Season 1"},
    )
    assert res1.status_code == 201

    res2 = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Another Season 1"},
    )
    assert res2.status_code == 409
    assert res2.json()["detail"] == "Season with this number already exists for this show"


@pytest.mark.asyncio
async def test_season_zero_is_allowed(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="season-zero-show")

    res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 0, "title": "Trailers"},
    )
    assert res.status_code == 201
    assert res.json()["season_number"] == 0
    assert res.json()["title"] == "Trailers"


@pytest.mark.asyncio
async def test_partial_update_season(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="partial-season-show")

    create_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": 1, "title": "Original Title"},
    )
    season_id = create_res.json()["id"]

    patch_res = await client.patch(
        f"/seasons/{season_id}",
        headers=headers,
        json={"title": "Updated Title Only"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated Title Only"
    assert patch_res.json()["season_number"] == 1


@pytest.mark.asyncio
async def test_ordered_season_listing(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    show_id = await create_test_show(client, token, slug="ordered-seasons-show")

    await client.post(f"/shows/{show_id}/seasons", headers=headers, json={"season_number": 2, "title": "Season 2"})
    await client.post(f"/shows/{show_id}/seasons", headers=headers, json={"season_number": 0, "title": "Season 0"})
    await client.post(f"/shows/{show_id}/seasons", headers=headers, json={"season_number": 1, "title": "Season 1"})

    list_res = await client.get(f"/shows/{show_id}/seasons", headers=headers)
    assert list_res.status_code == 200
    seasons = list_res.json()
    assert len(seasons) == 3
    assert [s["season_number"] for s in seasons] == [0, 1, 2]

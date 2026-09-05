import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


async def create_test_show_and_season(
    client: AsyncClient, token: str, slug: str = "test-show", season_number: int = 1
) -> int:
    headers = {"Authorization": f"Bearer {token}"}
    show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Test Show", "slug": slug, "section": "series"},
    )
    assert show_res.status_code == 201
    show_id = show_res.json()["id"]

    season_res = await client.post(
        f"/shows/{show_id}/seasons",
        headers=headers,
        json={"season_number": season_number, "title": "Season 1"},
    )
    assert season_res.status_code == 201
    return season_res.json()["id"]


@pytest.mark.asyncio
async def test_unauthenticated_requests_return_401(client: AsyncClient):
    assert (await client.get("/seasons/1/episodes")).status_code == 401
    assert (await client.get("/episodes/ep_0001")).status_code == 401
    assert (
        await client.post(
            "/seasons/1/episodes",
            json={
                "episode_id": "ep_0001",
                "episode_number": 1,
                "title": "Ep 1",
                "language": "en",
                "content_group": "cg_1",
            },
        )
    ).status_code == 401
    assert (
        await client.patch("/episodes/ep_0001", json={"title": "Updated"})
    ).status_code == 401
    assert (await client.delete("/episodes/ep_0001")).status_code == 401


@pytest.mark.asyncio
async def test_editor_crud(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="editor-show", season_number=1
    )

    create_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_editor_1",
            "episode_number": 1,
            "title": "Editor Episode",
            "synopsis": "Synopsis 1",
            "duration_seconds": 120,
            "language": "en",
            "content_group": "cg_editor_1",
            "status": "draft",
        },
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["episode_id"] == "ep_editor_1"
    assert data["season_id"] == season_id
    assert data["episode_number"] == 1
    assert data["title"] == "Editor Episode"
    assert data["synopsis"] == "Synopsis 1"
    assert data["duration_seconds"] == 120
    assert data["language"] == "en"
    assert data["content_group"] == "cg_editor_1"
    assert data["status"] == "draft"

    get_res = await client.get("/episodes/ep_editor_1", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["season_id"] == season_id
    assert get_res.json()["episode_id"] == "ep_editor_1"

    patch_res = await client.patch(
        "/episodes/ep_editor_1",
        headers=headers,
        json={"title": "Updated Title"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated Title"

    delete_res = await client.delete("/episodes/ep_editor_1", headers=headers)
    assert delete_res.status_code == 204

    assert (await client.get("/episodes/ep_editor_1", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_admin_crud(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="admin-show", season_number=1
    )

    create_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_admin_1",
            "episode_number": 1,
            "title": "Admin Episode",
            "synopsis": "Admin synopsis",
            "duration_seconds": 300,
            "language": "hi",
            "content_group": "cg_admin_1",
            "status": "published",
        },
    )
    assert create_res.status_code == 201
    assert create_res.json()["status"] == "published"

    get_res = await client.get("/episodes/ep_admin_1", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["language"] == "hi"

    delete_res = await client.delete("/episodes/ep_admin_1", headers=headers)
    assert delete_res.status_code == 204


@pytest.mark.asyncio
async def test_nonexistent_season_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    get_res = await client.get("/seasons/99999/episodes", headers=headers)
    assert get_res.status_code == 404
    assert get_res.json()["detail"] == "Season not found"

    post_res = await client.post(
        "/seasons/99999/episodes",
        headers=headers,
        json={
            "episode_id": "ep_404",
            "episode_number": 1,
            "title": "Ep 404",
            "language": "en",
            "content_group": "cg_404",
        },
    )
    assert post_res.status_code == 404
    assert post_res.json()["detail"] == "Season not found"


@pytest.mark.asyncio
async def test_nonexistent_episode_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.get("/episodes/nonexistent_ep", headers=headers)).status_code == 404
    assert (
        await client.patch(
            "/episodes/nonexistent_ep",
            headers=headers,
            json={"title": "Updated"},
        )
    ).status_code == 404
    assert (await client.delete("/episodes/nonexistent_ep", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_duplicate_episode_id_returns_409(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="dup-ep-show", season_number=1
    )

    res1 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_dup_id",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "en",
            "content_group": "cg_dup_1",
        },
    )
    assert res1.status_code == 201

    res2 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_dup_id",
            "episode_number": 2,
            "title": "Ep 2",
            "language": "hi",
            "content_group": "cg_dup_2",
        },
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]

    # Test duplicate episode_id via PATCH
    res3 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_dup_id_other",
            "episode_number": 2,
            "title": "Ep 2",
            "language": "hi",
            "content_group": "cg_dup_3",
        },
    )
    assert res3.status_code == 201

    patch_res = await client.patch(
        "/episodes/ep_dup_id_other",
        headers=headers,
        json={"episode_id": "ep_dup_id"},
    )
    assert patch_res.status_code == 409
    assert "already exists" in patch_res.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_content_group_and_language_returns_409(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="dup-cg-show", season_number=1
    )

    res1 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_cg_1",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "en",
            "content_group": "cg_shared",
        },
    )
    assert res1.status_code == 201

    res2 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_cg_2",
            "episode_number": 2,
            "title": "Ep 2",
            "language": "en",
            "content_group": "cg_shared",
        },
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]

    # Different language with same content_group is allowed
    res3 = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_cg_3",
            "episode_number": 3,
            "title": "Ep 3",
            "language": "hi",
            "content_group": "cg_shared",
        },
    )
    assert res3.status_code == 201

    # Conflict on PATCH
    patch_res = await client.patch(
        "/episodes/ep_cg_3",
        headers=headers,
        json={"language": "en"},
    )
    assert patch_res.status_code == 409
    assert "already exists" in patch_res.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_language_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="lang-test-show", season_number=1
    )

    res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_lang_1",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "fr",
            "content_group": "cg_lang_1",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_invalid_status_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="status-test-show", season_number=1
    )

    res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_status_1",
            "episode_number": 1,
            "title": "Ep 1",
            "language": "en",
            "content_group": "cg_status_1",
            "status": "archived",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_episode_number_validation(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="epnum-test-show", season_number=1
    )

    res_zero = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_num_0",
            "episode_number": 0,
            "title": "Ep 0",
            "language": "en",
            "content_group": "cg_num_0",
        },
    )
    assert res_zero.status_code == 422

    res_neg = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_num_neg",
            "episode_number": -5,
            "title": "Ep Neg",
            "language": "en",
            "content_group": "cg_num_neg",
        },
    )
    assert res_neg.status_code == 422


@pytest.mark.asyncio
async def test_published_episode_without_duration_returns_422(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="pub-dur-show", season_number=1
    )

    # POST published without duration
    post_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_pub_nodur",
            "episode_number": 1,
            "title": "Pub No Dur",
            "language": "en",
            "content_group": "cg_pub_nodur",
            "status": "published",
        },
    )
    assert post_res.status_code == 422

    # POST draft without duration (allowed)
    draft_res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_draft_ok",
            "episode_number": 2,
            "title": "Draft Ok",
            "language": "en",
            "content_group": "cg_draft_ok",
            "status": "draft",
        },
    )
    assert draft_res.status_code == 201

    # PATCH draft to published without duration -> 422
    patch_res = await client.patch(
        "/episodes/ep_draft_ok",
        headers=headers,
        json={"status": "published"},
    )
    assert patch_res.status_code == 422

    # PATCH draft with duration and published -> 200
    patch_ok_res = await client.patch(
        "/episodes/ep_draft_ok",
        headers=headers,
        json={"status": "published", "duration_seconds": 150},
    )
    assert patch_ok_res.status_code == 200
    assert patch_ok_res.json()["status"] == "published"
    assert patch_ok_res.json()["duration_seconds"] == 150


@pytest.mark.asyncio
async def test_ordered_episode_listing(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="ordered-show", season_number=1
    )

    # Add episodes out of order
    for ep_num in [3, 1, 2]:
        res = await client.post(
            f"/seasons/{season_id}/episodes",
            headers=headers,
            json={
                "episode_id": f"ep_order_{ep_num}",
                "episode_number": ep_num,
                "title": f"Ep {ep_num}",
                "language": "en",
                "content_group": f"cg_order_{ep_num}",
            },
        )
        assert res.status_code == 201

    list_res = await client.get(f"/seasons/{season_id}/episodes", headers=headers)
    assert list_res.status_code == 200
    episodes = list_res.json()
    assert len(episodes) == 3
    numbers = [ep["episode_number"] for ep in episodes]
    assert numbers == [1, 2, 3]


@pytest.mark.asyncio
async def test_partial_update(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="partial-update-show", season_number=1
    )

    res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_partial",
            "episode_number": 1,
            "title": "Original Title",
            "synopsis": "Original Synopsis",
            "duration_seconds": 200,
            "language": "en",
            "content_group": "cg_partial",
            "status": "draft",
        },
    )
    assert res.status_code == 201

    # Update only title and synopsis
    patch_res = await client.patch(
        "/episodes/ep_partial",
        headers=headers,
        json={"title": "New Title", "synopsis": "New Synopsis"},
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["title"] == "New Title"
    assert data["synopsis"] == "New Synopsis"
    assert data["duration_seconds"] == 200
    assert data["language"] == "en"
    assert data["content_group"] == "cg_partial"
    assert data["status"] == "draft"
    assert data["episode_number"] == 1


@pytest.mark.asyncio
async def test_delete_episode(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    season_id = await create_test_show_and_season(
        client, token, slug="delete-test-show", season_number=1
    )

    res = await client.post(
        f"/seasons/{season_id}/episodes",
        headers=headers,
        json={
            "episode_id": "ep_to_delete",
            "episode_number": 1,
            "title": "To Delete",
            "language": "en",
            "content_group": "cg_to_delete",
        },
    )
    assert res.status_code == 201

    del_res = await client.delete("/episodes/ep_to_delete", headers=headers)
    assert del_res.status_code == 204

    get_res = await client.get("/episodes/ep_to_delete", headers=headers)
    assert get_res.status_code == 404

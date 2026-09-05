import io
import os
import pytest
from httpx import AsyncClient
from PIL import Image


def create_image_bytes(
    width: int, height: int, format: str = "JPEG", color: str = "blue"
) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def create_oversized_image_bytes(width: int, height: int) -> bytes:
    random_bytes = os.urandom(width * height * 3)
    img = Image.frombytes("RGB", (width, height), random_bytes)
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=0)
    data = buf.getvalue()
    assert len(data) > 200 * 1024
    return data


async def get_auth_token(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


async def setup_episode(client: AsyncClient, token: str, ep_id: str = "ep_art_1") -> str:
    headers = {"Authorization": f"Bearer {token}"}
    show_res = await client.post(
        "/shows",
        headers=headers,
        json={"title": "Art Show", "slug": f"show-{ep_id}", "section": "series"},
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
            "episode_id": ep_id,
            "episode_number": 1,
            "title": "Art Episode",
            "language": "en",
            "content_group": f"cg_{ep_id}",
        },
    )
    return ep_res.json()["episode_id"]


@pytest.mark.asyncio
async def test_unauthenticated_requests_return_401(client: AsyncClient):
    assert (await client.get("/episodes/ep_0001/artwork")).status_code == 401
    assert (
        await client.post(
            "/episodes/ep_0001/artwork",
            data={"artwork_type": "poster"},
            files={"file": ("poster.jpg", b"fake", "image/jpeg")},
        )
    ).status_code == 401
    assert (await client.delete("/episodes/ep_0001/artwork/poster")).status_code == 401


@pytest.mark.asyncio
async def test_valid_poster_upload(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_poster_valid")

    img_data = create_image_bytes(600, 900, "JPEG")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", img_data, "image/jpeg")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["artwork_type"] == "poster"
    assert data["width"] == 600
    assert data["height"] == 900
    assert data["mime_type"] == "image/jpeg"
    assert "poster.jpg" in data["file_path"]


@pytest.mark.asyncio
async def test_valid_banner_upload(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_banner_valid")

    img_data = create_image_bytes(1280, 720, "PNG")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "banner"},
        files={"file": ("banner.png", img_data, "image/png")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["artwork_type"] == "banner"
    assert data["width"] == 1280
    assert data["height"] == 720
    assert data["mime_type"] == "image/png"


@pytest.mark.asyncio
async def test_valid_thumbnail_upload(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_thumb_valid")

    img_data = create_image_bytes(640, 360, "WEBP")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "thumbnail"},
        files={"file": ("thumbnail.webp", img_data, "image/webp")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["artwork_type"] == "thumbnail"
    assert data["width"] == 640
    assert data["height"] == 360
    assert data["mime_type"] == "image/webp"


@pytest.mark.asyncio
async def test_tiny_thumbnail_fails_validation(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_thumb_tiny")

    img_data = create_image_bytes(100, 100, "JPEG")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "thumbnail"},
        files={"file": ("thumb.jpg", img_data, "image/jpeg")},
    )
    assert res.status_code == 422
    assert "Thumbnail must be exactly 640x360 pixels." in res.json()["detail"]


@pytest.mark.asyncio
async def test_wrong_poster_dimensions_fails_validation(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_poster_wrong")

    img_data = create_image_bytes(500, 500, "JPEG")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", img_data, "image/jpeg")},
    )
    assert res.status_code == 422
    assert "Poster must be exactly 600x900 pixels." in res.json()["detail"]


@pytest.mark.asyncio
async def test_oversized_file_fails_validation(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_oversized")

    oversized_data = create_oversized_image_bytes(600, 900)
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.png", oversized_data, "image/png")},
    )
    assert res.status_code == 422
    assert "Poster must be no larger than 200 KB." in res.json()["detail"]


@pytest.mark.asyncio
async def test_unsupported_non_image_fails_validation(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_nonimage")

    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("test.txt", b"this is not an image", "text/plain")},
    )
    assert res.status_code == 422
    assert "Invalid or unsupported image file." in res.json()["detail"]


@pytest.mark.asyncio
async def test_nonexistent_episode_returns_404(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}

    img_data = create_image_bytes(600, 900, "JPEG")
    post_res = await client.post(
        "/episodes/nonexistent_ep/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", img_data, "image/jpeg")},
    )
    assert post_res.status_code == 404

    get_res = await client.get("/episodes/nonexistent_ep/artwork", headers=headers)
    assert get_res.status_code == 404

    del_res = await client.delete("/episodes/nonexistent_ep/artwork/poster", headers=headers)
    assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_replacing_existing_artwork(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_replace_art")

    img_data_1 = create_image_bytes(600, 900, "JPEG", color="blue")
    res1 = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", img_data_1, "image/jpeg")},
    )
    assert res1.status_code == 201
    art_id_1 = res1.json()["id"]

    # Replace with PNG poster
    img_data_2 = create_image_bytes(600, 900, "PNG", color="red")
    res2 = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.png", img_data_2, "image/png")},
    )
    assert res2.status_code == 201
    assert res2.json()["id"] == art_id_1
    assert res2.json()["mime_type"] == "image/png"
    assert "poster.png" in res2.json()["file_path"]

    # Verify only one poster exists
    get_res = await client.get(f"/episodes/{ep_id}/artwork", headers=headers)
    assert get_res.status_code == 200
    artworks = get_res.json()
    assert len(artworks) == 1
    assert artworks[0]["mime_type"] == "image/png"


@pytest.mark.asyncio
async def test_retrieving_artwork_metadata(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_meta_test")

    poster_data = create_image_bytes(600, 900, "JPEG")
    banner_data = create_image_bytes(1280, 720, "JPEG")
    thumb_data = create_image_bytes(640, 360, "JPEG")

    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", poster_data, "image/jpeg")},
    )
    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "banner"},
        files={"file": ("banner.jpg", banner_data, "image/jpeg")},
    )
    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "thumbnail"},
        files={"file": ("thumb.jpg", thumb_data, "image/jpeg")},
    )

    get_res = await client.get(f"/episodes/{ep_id}/artwork", headers=headers)
    assert get_res.status_code == 200
    artworks = get_res.json()
    assert len(artworks) == 3
    types = {a["artwork_type"] for a in artworks}
    assert types == {"poster", "banner", "thumbnail"}


@pytest.mark.asyncio
async def test_deleting_artwork(client: AsyncClient):
    token = await get_auth_token(client, "editor_user", "editorpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_del_test")

    poster_data = create_image_bytes(600, 900, "JPEG")
    await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", poster_data, "image/jpeg")},
    )

    del_res = await client.delete(f"/episodes/{ep_id}/artwork/poster", headers=headers)
    assert del_res.status_code == 204

    # Subsequent delete of same artwork returns 404
    del_res2 = await client.delete(f"/episodes/{ep_id}/artwork/poster", headers=headers)
    assert del_res2.status_code == 404

    # GET artwork returns empty list
    get_res = await client.get(f"/episodes/{ep_id}/artwork", headers=headers)
    assert get_res.status_code == 200
    assert len(get_res.json()) == 0


@pytest.mark.asyncio
async def test_admin_artwork_access(client: AsyncClient):
    token = await get_auth_token(client, "admin_user", "adminpass123")
    headers = {"Authorization": f"Bearer {token}"}
    ep_id = await setup_episode(client, token, "ep_admin_art")

    poster_data = create_image_bytes(600, 900, "JPEG")
    res = await client.post(
        f"/episodes/{ep_id}/artwork",
        headers=headers,
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", poster_data, "image/jpeg")},
    )
    assert res.status_code == 201

    get_res = await client.get(f"/episodes/{ep_id}/artwork", headers=headers)
    assert get_res.status_code == 200

    del_res = await client.delete(f"/episodes/{ep_id}/artwork/poster", headers=headers)
    assert del_res.status_code == 204

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.auth import require_admin
from app.models import User


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={"username": "admin_user", "password": "adminpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin_user"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={"username": "admin_user", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={"username": "nonexistent", "password": "password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    response = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    login_res = await client.post(
        "/auth/login",
        json={"username": "editor_user", "password": "editorpass123"},
    )
    token = login_res.json()["access_token"]

    response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "editor_user"
    assert data["role"] == "editor"
    assert "id" in data


@pytest.mark.asyncio
async def test_editor_authorization_failure_on_admin_endpoint(client: AsyncClient):
    login_res = await client.post(
        "/auth/login",
        json={"username": "editor_user", "password": "editorpass123"},
    )
    token = login_res.json()["access_token"]

    response = await client.get(
        "/test-admin-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin privilege required"


@pytest.mark.asyncio
async def test_admin_authorization_success_on_admin_endpoint(client: AsyncClient):
    login_res = await client.post(
        "/auth/login",
        json={"username": "admin_user", "password": "adminpass123"},
    )
    token = login_res.json()["access_token"]

    response = await client.get(
        "/test-admin-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "admin access granted"


@pytest.mark.asyncio
async def test_require_admin_dependency_directly():
    editor = User(id=1, username="editor", password_hash="hash", role="editor")
    admin = User(id=2, username="admin", password_hash="hash", role="admin")

    with pytest.raises(HTTPException) as exc_info:
        await require_admin(current_user=editor)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Admin privilege required"

    admin_result = await require_admin(current_user=admin)
    assert admin_result == admin

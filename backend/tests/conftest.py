from collections.abc import AsyncGenerator
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import hash_password, require_admin
from app.db import Base, get_db
from app.models import User
from app.routers.artwork import router as artwork_router
from app.routers.auth import router as auth_router
from app.routers.catalog import router as catalog_router
from app.routers.episodes import router as episodes_router
from app.routers.seasons import router as seasons_router
from app.routers.shows import router as shows_router

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_maker = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


def create_test_app() -> FastAPI:
    test_app = FastAPI(title="Peblo TV Test API")
    test_app.include_router(auth_router)
    test_app.include_router(shows_router)
    test_app.include_router(seasons_router)
    test_app.include_router(episodes_router)
    test_app.include_router(artwork_router)
    test_app.include_router(catalog_router)

    @test_app.get("/test-admin-only")
    async def admin_only_endpoint(user: User = Depends(require_admin)):
        return {"message": "admin access granted", "username": user.username}

    return test_app


app_for_testing = create_test_app()


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_maker() as session:
        yield session


app_for_testing.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_maker() as session:
        admin = User(
            username="admin_user",
            password_hash=hash_password("adminpass123"),
            role="admin",
        )
        editor = User(
            username="editor_user",
            password_hash=hash_password("editorpass123"),
            role="editor",
        )
        session.add_all([admin, editor])
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app_for_testing)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_maker() as session:
        yield session


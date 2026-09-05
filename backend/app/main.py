from pathlib import Path
from fastapi import Depends, FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.routers.artwork import router as artwork_router
from app.routers.auth import router as auth_router
from app.routers.catalog import router as catalog_router
from app.routers.episodes import router as episodes_router
from app.routers.seasons import router as seasons_router
from app.routers.shows import router as shows_router

app = FastAPI(title="Peblo TV API")
app.include_router(auth_router)
app.include_router(shows_router)
app.include_router(seasons_router)
app.include_router(episodes_router)
app.include_router(artwork_router)
app.include_router(catalog_router)


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "error", "database": "disconnected"},
        )


storage_candidates = [
    Path("/app/storage"),
    Path("storage"),
    Path("../storage"),
    Path(__file__).resolve().parent.parent.parent / "storage",
]
storage_dir = Path("/app/storage")
for c in storage_candidates:
    if c.is_dir():
        storage_dir = c
        break

storage_dir.mkdir(parents=True, exist_ok=True)
artwork_dir = storage_dir / "artwork"
artwork_dir.mkdir(parents=True, exist_ok=True)

app.mount("/storage", StaticFiles(directory=str(storage_dir)), name="storage")
app.mount("/artwork", StaticFiles(directory=str(artwork_dir)), name="artwork")

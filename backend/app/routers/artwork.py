import io
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_db
from app.models import Artwork, Episode, User
from app.schemas.artwork import ArtworkResponse
from app.storage import StorageBackend, get_storage

router = APIRouter(tags=["artwork"])

MAX_FILE_SIZE_BYTES = 200 * 1024

ARTWORK_SPECS = {
    "poster": {"width": 600, "height": 900, "label": "Poster"},
    "banner": {"width": 1280, "height": 720, "label": "Banner"},
    "thumbnail": {"width": 640, "height": 360, "label": "Thumbnail"},
}

SUPPORTED_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}


HTTP_422 = (
    status.HTTP_422_UNPROCESSABLE_CONTENT
    if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
    else status.HTTP_422_UNPROCESSABLE_ENTITY
)


@router.post(
    "/episodes/{episode_id}/artwork",
    response_model=ArtworkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_artwork(
    episode_id: str,
    artwork_type: Optional[str] = Form(None),
    artwork_type_query: Optional[str] = Query(None, alias="artwork_type"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    selected_type = artwork_type or artwork_type_query
    if not selected_type or selected_type not in ARTWORK_SPECS:
        raise HTTPException(
            status_code=HTTP_422,
            detail="artwork_type must be one of: poster, banner, thumbnail",
        )

    spec = ARTWORK_SPECS[selected_type]

    stmt = select(Episode).where(Episode.episode_id == episode_id)
    episode = (await db.execute(stmt)).scalar_one_or_none()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=HTTP_422,
            detail="Uploaded file is empty.",
        )

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=HTTP_422,
            detail=f"{spec['label']} must be no larger than 200 KB.",
        )

    try:
        image = Image.open(io.BytesIO(contents))
        image.verify()
        image = Image.open(io.BytesIO(contents))
        img_format = image.format
        width, height = image.size
    except (UnidentifiedImageError, Exception):
        raise HTTPException(
            status_code=HTTP_422,
            detail="Invalid or unsupported image file.",
        )

    if img_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=HTTP_422,
            detail="Invalid or unsupported image format. Supported formats: JPEG, PNG, WebP.",
        )

    if (width, height) != (spec["width"], spec["height"]):
        raise HTTPException(
            status_code=HTTP_422,
            detail=f"{spec['label']} must be exactly {spec['width']}x{spec['height']} pixels.",
        )

    ext, mime_type = SUPPORTED_FORMATS[img_format]
    storage_path = f"artwork/{episode_id}/{selected_type}{ext}"

    art_stmt = select(Artwork).where(
        Artwork.episode_id == episode.id,
        Artwork.artwork_type == selected_type,
    )
    existing_artwork = (await db.execute(art_stmt)).scalar_one_or_none()

    if existing_artwork:
        old_path = existing_artwork.file_path
        await storage.save(storage_path, contents, content_type=mime_type)
        if old_path != storage_path:
            await storage.delete(old_path)

        existing_artwork.file_path = storage_path
        existing_artwork.width = width
        existing_artwork.height = height
        existing_artwork.file_size = len(contents)
        existing_artwork.mime_type = mime_type

        await db.commit()
        reloaded = (
            await db.execute(select(Artwork).where(Artwork.id == existing_artwork.id))
        ).scalar_one()
        return reloaded
    else:
        await storage.save(storage_path, contents, content_type=mime_type)
        new_artwork = Artwork(
            episode_id=episode.id,
            artwork_type=selected_type,
            file_path=storage_path,
            width=width,
            height=height,
            file_size=len(contents),
            mime_type=mime_type,
        )
        db.add(new_artwork)
        await db.commit()
        reloaded = (
            await db.execute(select(Artwork).where(Artwork.id == new_artwork.id))
        ).scalar_one()
        return reloaded


@router.get("/episodes/{episode_id}/artwork", response_model=List[ArtworkResponse])
async def get_episode_artwork(
    episode_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Episode).where(Episode.episode_id == episode_id)
    episode = (await db.execute(stmt)).scalar_one_or_none()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    art_stmt = (
        select(Artwork)
        .where(Artwork.episode_id == episode.id)
        .order_by(Artwork.id.asc())
    )
    artwork_list = (await db.execute(art_stmt)).scalars().all()
    return list(artwork_list)


@router.delete(
    "/episodes/{episode_id}/artwork/{artwork_type}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_episode_artwork(
    episode_id: str,
    artwork_type: str,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Episode).where(Episode.episode_id == episode_id)
    episode = (await db.execute(stmt)).scalar_one_or_none()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    art_stmt = select(Artwork).where(
        Artwork.episode_id == episode.id,
        Artwork.artwork_type == artwork_type,
    )
    artwork = (await db.execute(art_stmt)).scalar_one_or_none()
    if not artwork:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artwork not found",
        )

    await storage.delete(artwork.file_path)
    await db.delete(artwork)
    await db.commit()

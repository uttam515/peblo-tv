from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_db
from app.models import Episode, Season, User
from app.schemas.episode import EpisodeCreate, EpisodeResponse, EpisodeUpdate

router = APIRouter(tags=["episodes"])


@router.get("/seasons/{season_id}/episodes", response_model=List[EpisodeResponse])
async def list_episodes_for_season(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    season = (
        await db.execute(select(Season.id).where(Season.id == season_id))
    ).scalar_one_or_none()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    stmt = (
        select(Episode)
        .where(Episode.season_id == season_id)
        .order_by(Episode.episode_number.asc())
    )
    episodes = (await db.execute(stmt)).scalars().all()
    return list(episodes)


@router.post(
    "/seasons/{season_id}/episodes",
    response_model=EpisodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_episode(
    season_id: int,
    data: EpisodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    season = (
        await db.execute(select(Season.id).where(Season.id == season_id))
    ).scalar_one_or_none()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    existing_id = (
        await db.execute(select(Episode.id).where(Episode.episode_id == data.episode_id))
    ).scalar_one_or_none()
    if existing_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Episode with episode_id '{data.episode_id}' already exists",
        )

    existing_cg = (
        await db.execute(
            select(Episode.id).where(
                Episode.content_group == data.content_group,
                Episode.language == data.language,
            )
        )
    ).scalar_one_or_none()
    if existing_cg:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Episode with content_group '{data.content_group}' and language '{data.language}' already exists",
        )

    episode = Episode(
        season_id=season_id,
        episode_id=data.episode_id,
        episode_number=data.episode_number,
        title=data.title,
        synopsis=data.synopsis,
        duration_seconds=data.duration_seconds,
        language=data.language,
        content_group=data.content_group,
        status=data.status,
    )
    db.add(episode)
    await db.commit()

    reloaded = (
        await db.execute(select(Episode).where(Episode.id == episode.id))
    ).scalar_one()
    return reloaded


@router.get("/episodes/{episode_id}", response_model=EpisodeResponse)
async def get_episode(
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

    return episode


@router.patch("/episodes/{episode_id}", response_model=EpisodeResponse)
async def update_episode(
    episode_id: str,
    data: EpisodeUpdate,
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

    update_data = data.model_dump(exclude_unset=True)

    if "episode_id" in update_data and update_data["episode_id"] != episode.episode_id:
        conflict_id = (
            await db.execute(
                select(Episode.id).where(
                    Episode.episode_id == update_data["episode_id"],
                    Episode.id != episode.id,
                )
            )
        ).scalar_one_or_none()
        if conflict_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Episode with episode_id '{update_data['episode_id']}' already exists",
            )

    target_cg = update_data.get("content_group", episode.content_group)
    target_lang = update_data.get("language", episode.language)
    if target_cg != episode.content_group or target_lang != episode.language:
        conflict_cg = (
            await db.execute(
                select(Episode.id).where(
                    Episode.content_group == target_cg,
                    Episode.language == target_lang,
                    Episode.id != episode.id,
                )
            )
        ).scalar_one_or_none()
        if conflict_cg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Episode with content_group '{target_cg}' and language '{target_lang}' already exists",
            )

    target_status = update_data.get("status", episode.status)
    target_duration = update_data.get("duration_seconds", episode.duration_seconds)
    if target_status == "published" and target_duration is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT") is False
            else status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Published episode must have duration_seconds",
        )

    for field, value in update_data.items():
        setattr(episode, field, value)

    await db.commit()

    reloaded = (
        await db.execute(select(Episode).where(Episode.id == episode.id))
    ).scalar_one()
    return reloaded


@router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode(
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

    await db.delete(episode)
    await db.commit()

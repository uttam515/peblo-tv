from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.db import get_db
from app.models import Episode, Season, Show, User
from app.schemas.catalog import PublishSeriesResponse
from app.schemas.show import ShowCreate, ShowListResponse, ShowResponse, ShowUpdate

router = APIRouter(prefix="/shows", tags=["shows"])



@router.get("", response_model=ShowListResponse)
async def list_shows(
    q: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = select(Show)

    if q:
        base_query = base_query.where(Show.title.ilike(f"%{q}%"))
    if section:
        base_query = base_query.where(Show.section == section)
    if status:
        base_query = base_query.where(Show.status == status)

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    results_query = (
        base_query.options(selectinload(Show.categories))
        .order_by(Show.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    shows = (await db.execute(results_query)).scalars().all()

    return ShowListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=list(shows),
    )


@router.get("/{show_id}", response_model=ShowResponse)
async def get_show(
    show_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Show)
        .options(selectinload(Show.categories))
        .where(Show.id == show_id)
    )
    show = (await db.execute(stmt)).scalar_one_or_none()

    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    return show


@router.post("", response_model=ShowResponse, status_code=status.HTTP_201_CREATED)
async def create_show(
    data: ShowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_stmt = select(Show).where(Show.slug == data.slug)
    existing_show = (await db.execute(existing_stmt)).scalar_one_or_none()

    if existing_show:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Show with this slug already exists",
        )

    show = Show(
        title=data.title,
        slug=data.slug,
        section=data.section,
        description=data.description,
        status=data.status,
    )
    db.add(show)
    await db.commit()

    reloaded = (
        await db.execute(
            select(Show)
            .options(selectinload(Show.categories))
            .where(Show.id == show.id)
        )
    ).scalar_one()

    return reloaded


@router.patch("/{show_id}", response_model=ShowResponse)
async def update_show(
    show_id: int,
    data: ShowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Show)
        .options(selectinload(Show.categories))
        .where(Show.id == show_id)
    )
    show = (await db.execute(stmt)).scalar_one_or_none()

    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"] != show.slug:
        conflict_stmt = select(Show).where(
            Show.slug == update_data["slug"], Show.id != show_id
        )
        conflicting_show = (await db.execute(conflict_stmt)).scalar_one_or_none()
        if conflicting_show:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Show with this slug already exists",
            )

    if update_data.get("status") == "draft":
        # Atomically cascade all episodes belonging to this show to draft
        season_ids_stmt = select(Season.id).where(Season.show_id == show_id)
        season_ids = (await db.execute(season_ids_stmt)).scalars().all()
        if season_ids:
            await db.execute(
                update(Episode)
                .where(Episode.season_id.in_(season_ids))
                .values(status="draft")
            )

    for field, value in update_data.items():
        setattr(show, field, value)

    await db.commit()

    reloaded = (
        await db.execute(
            select(Show)
            .options(selectinload(Show.categories))
            .where(Show.id == show_id)
        )
    ).scalar_one()

    return reloaded


@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_show(
    show_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Show).where(Show.id == show_id)
    show = (await db.execute(stmt)).scalar_one_or_none()

    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    await db.delete(show)
    await db.commit()


@router.post("/{show_id}/publish", response_model=PublishSeriesResponse)
async def publish_series(
    show_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Show)
        .options(selectinload(Show.seasons).selectinload(Season.episodes))
        .where(Show.id == show_id)
    )
    show = (await db.execute(stmt)).scalar_one_or_none()

    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    episodes_to_publish: list[Episode] = []
    invalid_episodes: list[str] = []

    for season in show.seasons:
        for episode in season.episodes:
            if episode.status == "draft":
                if episode.duration_seconds is None or episode.duration_seconds <= 0:
                    invalid_episodes.append(
                        f"Episode '{episode.episode_id}' ({episode.title}) is missing duration_seconds"
                    )
                else:
                    episodes_to_publish.append(episode)

    if invalid_episodes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT") is False
            else status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "message": "Cannot publish series: some draft episodes have invalid data",
                "errors": invalid_episodes,
            },
        )

    show.status = "published"
    for ep in episodes_to_publish:
        ep.status = "published"

    await db.commit()

    return PublishSeriesResponse(
        show_id=show.id,
        show_title=show.title,
        show_status=show.status,
        episodes_published_count=len(episodes_to_publish),
        message=f"Show '{show.title}' and {len(episodes_to_publish)} draft episode(s) published successfully.",
    )


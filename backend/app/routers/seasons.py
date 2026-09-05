from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_db
from app.models import Season, Show, User
from app.schemas.season import SeasonCreate, SeasonResponse, SeasonUpdate

router = APIRouter(tags=["seasons"])


@router.get("/shows/{show_id}/seasons", response_model=List[SeasonResponse])
async def list_seasons_for_show(
    show_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    show = (
        await db.execute(select(Show.id).where(Show.id == show_id))
    ).scalar_one_or_none()
    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    stmt = (
        select(Season)
        .where(Season.show_id == show_id)
        .order_by(Season.season_number.asc())
    )
    seasons = (await db.execute(stmt)).scalars().all()
    return list(seasons)


@router.post(
    "/shows/{show_id}/seasons",
    response_model=SeasonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_season(
    show_id: int,
    data: SeasonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    show = (
        await db.execute(select(Show.id).where(Show.id == show_id))
    ).scalar_one_or_none()
    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Show not found",
        )

    existing_stmt = select(Season).where(
        Season.show_id == show_id,
        Season.season_number == data.season_number,
    )
    existing_season = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing_season:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Season with this number already exists for this show",
        )

    season = Season(
        show_id=show_id,
        season_number=data.season_number,
        title=data.title,
    )
    db.add(season)
    await db.commit()

    reloaded = (
        await db.execute(select(Season).where(Season.id == season.id))
    ).scalar_one()
    return reloaded


@router.get("/seasons/{season_id}", response_model=SeasonResponse)
async def get_season(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Season).where(Season.id == season_id)
    season = (await db.execute(stmt)).scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    return season


@router.patch("/seasons/{season_id}", response_model=SeasonResponse)
async def update_season(
    season_id: int,
    data: SeasonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Season).where(Season.id == season_id)
    season = (await db.execute(stmt)).scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if (
        "season_number" in update_data
        and update_data["season_number"] != season.season_number
    ):
        conflict_stmt = select(Season).where(
            Season.show_id == season.show_id,
            Season.season_number == update_data["season_number"],
            Season.id != season_id,
        )
        conflict = (await db.execute(conflict_stmt)).scalar_one_or_none()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Season with this number already exists for this show",
            )

    for field, value in update_data.items():
        setattr(season, field, value)

    await db.commit()

    reloaded = (
        await db.execute(select(Season).where(Season.id == season_id))
    ).scalar_one()
    return reloaded


@router.delete("/seasons/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_season(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Season).where(Season.id == season_id)
    season = (await db.execute(stmt)).scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    await db.delete(season)
    await db.commit()

from datetime import datetime, timezone
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.db import get_db
from app.models import Episode, PublishRun, Show, User
from app.schemas.catalog import (
    CatalogEntityCounts,
    CatalogStatusResponse,
    PendingChangeItem,
    PendingChangesSummary,
    PublishResponse,
    PublishRunResponse,
)
from app.services.catalog import (
    generate_catalog_structure,
    validate_publishable_content,
)
from app.storage import StorageBackend, get_storage

router = APIRouter()

HTTP_422 = (
    status.HTTP_422_UNPROCESSABLE_CONTENT
    if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
    else status.HTTP_422_UNPROCESSABLE_ENTITY
)


@router.post(
    "/admin/catalog/publish",
    response_model=PublishResponse,
    tags=["catalog-admin"],
)
async def publish_catalog(
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    admin_user: User = Depends(require_admin),
):
    start_time = datetime.now(timezone.utc)
    errors, published_shows = await validate_publishable_content(db)

    if errors:
        run = PublishRun(
            triggered_by=admin_user.username,
            status="failed",
            shows_count=len(published_shows),
            episodes_count=0,
            started_at=start_time,
            completed_at=datetime.now(timezone.utc),
            summary=f"Validation failed with {len(errors)} error(s)",
        )
        db.add(run)
        await db.commit()

        raise HTTPException(
            status_code=HTTP_422,
            detail={
                "message": "Catalogue publish validation failed",
                "errors": [e.model_dump() for e in errors],
            },
        )

    catalog_data, shows_count, episodes_count = generate_catalog_structure(
        published_shows
    )
    catalogue_version = f"v_{start_time.strftime('%Y%m%d%H%M%S')}"
    catalog_json = catalog_data.model_dump_json(indent=2)

    await storage.save_atomic(
        "catalogue.json",
        catalog_json.encode("utf-8"),
        content_type="application/json",
    )

    run = PublishRun(
        triggered_by=admin_user.username,
        status="success",
        shows_count=shows_count,
        episodes_count=episodes_count,
        catalogue_version=catalogue_version,
        started_at=start_time,
        completed_at=datetime.now(timezone.utc),
        summary=f"Successfully published catalogue {catalogue_version} with {shows_count} shows and {episodes_count} episodes",
    )
    db.add(run)
    await db.commit()

    return PublishResponse(
        status="success",
        catalogue_version=catalogue_version,
        shows_count=shows_count,
        episodes_count=episodes_count,
        catalog=catalog_data,
    )


@router.get(
    "/admin/catalog/history",
    response_model=List[PublishRunResponse],
    tags=["catalog-admin"],
)
async def get_publish_history(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    stmt = (
        select(PublishRun)
        .order_by(PublishRun.started_at.desc().nullslast(), PublishRun.id.desc())
        .limit(limit)
    )
    runs = (await db.execute(stmt)).scalars().all()
    return list(runs)


@router.get(
    "/admin/catalog/status",
    response_model=CatalogStatusResponse,
    tags=["catalog-admin"],
)
async def get_catalog_status(
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    # Calculate live shows and episodes counts
    total_shows = (await db.execute(select(func.count(Show.id)))).scalar_one()
    published_shows_count = (
        await db.execute(select(func.count(Show.id)).where(Show.status == "published"))
    ).scalar_one()
    draft_shows_count = total_shows - published_shows_count

    total_episodes = (await db.execute(select(func.count(Episode.id)))).scalar_one()
    published_episodes_count = (
        await db.execute(
            select(func.count(Episode.id)).where(Episode.status == "published")
        )
    ).scalar_one()
    draft_episodes_count = total_episodes - published_episodes_count
    unique_episodes_count = (
        await db.execute(select(func.count(func.distinct(Episode.content_group))))
    ).scalar_one()

    shows_counts = CatalogEntityCounts(
        total=total_shows, published=published_shows_count, draft=draft_shows_count
    )
    episodes_counts = CatalogEntityCounts(
        total=total_episodes,
        published=published_episodes_count,
        draft=draft_episodes_count,
        unique=unique_episodes_count,
    )

    # Check if catalogue file exists and find last successful publish run
    catalogue_exists = await storage.exists("catalogue.json")
    last_run_stmt = (
        select(PublishRun)
        .where(PublishRun.status == "success")
        .order_by(PublishRun.started_at.desc().nullslast(), PublishRun.id.desc())
        .limit(1)
    )
    last_run = (await db.execute(last_run_stmt)).scalar_one_or_none()

    # Validate publishable content and generate candidate catalog data
    errors, published_shows = await validate_publishable_content(db)
    candidate_catalog, _, _ = generate_catalog_structure(published_shows)

    if not catalogue_exists or not last_run:
        pending_details = []
        shows_count = 0
        episodes_count = 0
        for s in published_shows:
            show_changes = []
            ep_count = sum(
                len([e for e in season.episodes if e.status == "published"])
                for season in s.seasons
            )
            show_changes.append(f"Ready for initial deployment ({ep_count} published episodes)")
            pending_details.append(
                PendingChangeItem(show_title=s.title, changes=show_changes)
            )
            shows_count += 1
            episodes_count += ep_count

        total_pending = shows_count + episodes_count
        pending_summary = PendingChangesSummary(
            shows_changed=shows_count,
            episodes_changed=episodes_count,
            artwork_changed=0,
            total_changes=total_pending,
            details=pending_details,
        )

        return CatalogStatusResponse(
            status="no_catalogue",
            catalogue_version=None,
            last_published_at=None,
            shows_count=shows_counts,
            episodes_count=episodes_counts,
            live_shows_count=None,
            live_episodes_count=None,
            validation_errors=errors,
            pending_changes=pending_summary,
        )

    # Read live catalogue from storage
    try:
        live_content = await storage.read("catalogue.json")
        live_data = json.loads(
            live_content.decode("utf-8") if isinstance(live_content, bytes) else live_content
        )
    except Exception:
        live_data = None

    changes_pending = False
    candidate_dump = candidate_catalog.model_dump()
    last_pub_time = last_run.completed_at or last_run.started_at

    pending_details: List[PendingChangeItem] = []
    shows_changed_count = 0
    episodes_changed_count = 0
    artwork_changed_count = 0

    live_show_ids = set()
    if live_data and "sections" in live_data:
        for sec in live_data["sections"]:
            for show_item in sec.get("shows", []):
                live_show_ids.add(show_item.get("id"))

    if live_data is None:
        changes_pending = True
    else:
        if candidate_dump != live_data:
            changes_pending = True

        for s in published_shows:
            show_changes = []
            is_new_show = s.id not in live_show_ids
            if is_new_show:
                show_changes.append("Show published to catalogue")
                changes_pending = True
            elif last_pub_time and s.updated_at and s.updated_at > last_pub_time:
                show_changes.append("Show metadata updated")
                changes_pending = True

            for season in s.seasons:
                if last_pub_time and season.updated_at and season.updated_at > last_pub_time:
                    season_label = (
                        "Trailers"
                        if season.season_number == 0
                        else f"Season {season.season_number}"
                    )
                    show_changes.append(f"{season_label} updated")
                    changes_pending = True

                for ep in season.episodes:
                    if ep.status == "published":
                        if last_pub_time and ep.updated_at and ep.updated_at > last_pub_time:
                            show_changes.append(f'Episode "{ep.title}" updated/published')
                            episodes_changed_count += 1
                            changes_pending = True
                        for art in ep.artwork:
                            if last_pub_time and art.updated_at and art.updated_at > last_pub_time:
                                show_changes.append(
                                    f'Episode "{ep.title}" {art.artwork_type.title()} updated'
                                )
                                artwork_changed_count += 1
                                changes_pending = True

            if show_changes:
                shows_changed_count += 1
                pending_details.append(
                    PendingChangeItem(show_title=s.title, changes=show_changes)
                )

        # Check if any show was removed/unpublished
        pub_ids = {s.id for s in published_shows}
        for removed_id in live_show_ids - pub_ids:
            shows_changed_count += 1
            changes_pending = True
            pending_details.append(
                PendingChangeItem(
                    show_title=f"Show #{removed_id}",
                    changes=["Show unpublished or removed from catalogue"],
                )
            )

    total_changes = shows_changed_count + episodes_changed_count + artwork_changed_count
    pending_summary = (
        PendingChangesSummary(
            shows_changed=shows_changed_count,
            episodes_changed=episodes_changed_count,
            artwork_changed=artwork_changed_count,
            total_changes=total_changes if total_changes > 0 else (1 if changes_pending else 0),
            details=pending_details,
        )
        if changes_pending
        else None
    )

    return CatalogStatusResponse(
        status="changes_pending" if changes_pending else "live",
        catalogue_version=last_run.catalogue_version,
        last_published_at=last_run.completed_at or last_run.started_at,
        shows_count=shows_counts,
        episodes_count=episodes_counts,
        live_shows_count=last_run.shows_count,
        live_episodes_count=last_run.episodes_count,
        validation_errors=errors,
        pending_changes=pending_summary,
    )



@router.get("/catalog", tags=["catalog-public"])
async def get_public_catalog(
    storage: StorageBackend = Depends(get_storage),
):
    if not await storage.exists("catalogue.json"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalogue has not been published yet",
        )

    try:
        content = await storage.read("catalogue.json")
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalogue has not been published yet",
        )

    return Response(content=content, media_type="application/json")


@router.get("/catalog/search", tags=["catalog-public"])
async def search_public_catalog(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    storage: StorageBackend = Depends(get_storage),
):
    if not await storage.exists("catalogue.json"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalogue has not been published yet",
        )

    try:
        content = await storage.read("catalogue.json")
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalogue has not been published yet",
        )

    q_clean = q.strip().lower() if q and q.strip() else None
    cat_clean = category.strip().lower() if category and category.strip() else None
    lang_clean = language.strip().lower() if language and language.strip() else None
    sec_clean = section.strip().lower() if section and section.strip() else None

    if not (q_clean or cat_clean or lang_clean or sec_clean):
        return Response(content=content, media_type="application/json")

    catalog = json.loads(content)
    filtered_sections = []

    for sec in catalog.get("sections", []):
        sec_name = sec.get("name", "")
        if sec_clean and sec_name.lower() != sec_clean:
            continue

        filtered_shows = []
        for show in sec.get("shows", []):
            show_title = show.get("title", "")
            show_categories = [c.lower() for c in show.get("categories", [])]

            if cat_clean and cat_clean not in show_categories:
                continue

            show_title_match = bool(q_clean and q_clean in show_title.lower())
            show_cat_match = bool(q_clean and any(q_clean in c for c in show_categories))
            show_matches_q = show_title_match or show_cat_match

            filtered_seasons = []
            for sea in show.get("seasons", []):
                filtered_episodes = []
                for ep in sea.get("episodes", []):
                    ep_title = ep.get("title", "")
                    ep_langs = [l.lower() for l in ep.get("languages", [])]

                    if lang_clean and lang_clean not in ep_langs:
                        continue

                    if q_clean and not show_matches_q and q_clean not in ep_title.lower():
                        continue

                    filtered_episodes.append(ep)

                if filtered_episodes:
                    new_sea = dict(sea)
                    new_sea["episodes"] = filtered_episodes
                    filtered_seasons.append(new_sea)

            if filtered_seasons:
                new_show = dict(show)
                new_show["seasons"] = filtered_seasons
                filtered_shows.append(new_show)

        new_sec = dict(sec)
        new_sec["shows"] = filtered_shows
        filtered_sections.append(new_sec)

    return JSONResponse(content={"sections": filtered_sections})

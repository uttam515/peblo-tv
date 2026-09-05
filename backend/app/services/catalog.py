from typing import Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Episode, Season, Show
from app.schemas.catalog import (
    CatalogueData,
    CatalogueEpisode,
    CatalogueSeason,
    CatalogueSection,
    CatalogueShow,
    ValidationErrorItem,
)

VALID_SECTIONS = ["featured", "series", "minisodes", "songs"]
REQUIRED_ARTWORK_TYPES = ["poster", "banner", "thumbnail"]


def select_canonical_episode(episodes: List[Episode]) -> Episode:
    en_ep = next((ep for ep in episodes if ep.language == "en"), None)
    if en_ep:
        return en_ep
    return min(episodes, key=lambda ep: ep.language)


async def validate_publishable_content(
    db: AsyncSession,
) -> Tuple[List[ValidationErrorItem], List[Show]]:
    stmt = (
        select(Show)
        .options(
            selectinload(Show.categories),
            selectinload(Show.seasons)
            .selectinload(Season.episodes)
            .selectinload(Episode.artwork),
        )
    )
    shows = (await db.execute(stmt)).scalars().all()

    errors: List[ValidationErrorItem] = []
    published_shows: List[Show] = []

    for show in shows:
        if show.status == "published":
            published_shows.append(show)
            if not show.section or show.section not in VALID_SECTIONS:
                errors.append(
                    ValidationErrorItem(
                        entity_type="show",
                        entity_id=show.id,
                        title=show.title,
                        error=f"Published show '{show.title}' has invalid or missing section '{show.section}'",
                    )
                )

            for season in show.seasons:
                for episode in season.episodes:
                    if episode.status == "published":
                        if episode.duration_seconds is None or episode.duration_seconds <= 0:
                            errors.append(
                                ValidationErrorItem(
                                    entity_type="episode",
                                    entity_id=episode.episode_id,
                                    title=episode.title,
                                    error=f"Published episode '{episode.episode_id}' ({episode.title}) must have duration_seconds > 0",
                                )
                            )

                        existing_art = {a.artwork_type for a in episode.artwork}
                        for req_art in REQUIRED_ARTWORK_TYPES:
                            if req_art not in existing_art:
                                errors.append(
                                    ValidationErrorItem(
                                        entity_type="episode",
                                        entity_id=episode.episode_id,
                                        title=episode.title,
                                        error=f"Published episode '{episode.episode_id}' ({episode.title}) is missing {req_art} artwork",
                                    )
                                )

    return errors, published_shows


def generate_catalog_structure(
    published_shows: List[Show],
) -> Tuple[CatalogueData, int, int]:
    sections_catalog: List[CatalogueSection] = []
    total_shows = 0
    total_episodes = 0

    for section_name in VALID_SECTIONS:
        section_shows = [s for s in published_shows if s.section == section_name]
        section_shows.sort(key=lambda s: s.title)

        catalog_shows: List[CatalogueShow] = []
        for show in section_shows:
            total_shows += 1
            valid_seasons = [s for s in show.seasons if s.season_number != 0]
            valid_seasons.sort(key=lambda s: s.season_number)

            catalog_seasons: List[CatalogueSeason] = []
            for season in valid_seasons:
                pub_eps = [ep for ep in season.episodes if ep.status == "published"]
                if not pub_eps:
                    continue

                cg_groups: Dict[str, List[Episode]] = {}
                for ep in pub_eps:
                    cg_groups.setdefault(ep.content_group, []).append(ep)

                collapsed_episodes: List[CatalogueEpisode] = []
                for cg, ep_list in cg_groups.items():
                    total_episodes += 1
                    canonical = select_canonical_episode(ep_list)
                    languages = sorted(list(set(e.language for e in ep_list)))
                    art_map = {a.artwork_type: a.file_path for a in canonical.artwork}

                    collapsed_episodes.append(
                        CatalogueEpisode(
                            content_group=cg,
                            episode_number=canonical.episode_number,
                            title=canonical.title,
                            synopsis=canonical.synopsis,
                            duration_seconds=canonical.duration_seconds or 0,
                            languages=languages,
                            artwork=art_map,
                        )
                    )

                collapsed_episodes.sort(key=lambda e: e.episode_number)

                catalog_seasons.append(
                    CatalogueSeason(
                        season_number=season.season_number,
                        title=season.title,
                        episodes=collapsed_episodes,
                    )
                )

            categories = [c.slug for c in sorted(show.categories, key=lambda c: c.slug)]
            catalog_shows.append(
                CatalogueShow(
                    id=show.id,
                    title=show.title,
                    slug=show.slug,
                    section=show.section or section_name,
                    description=show.description,
                    categories=categories,
                    seasons=catalog_seasons,
                )
            )

        sections_catalog.append(
            CatalogueSection(
                name=section_name,
                shows=catalog_shows,
            )
        )

    return CatalogueData(sections=sections_catalog), total_shows, total_episodes

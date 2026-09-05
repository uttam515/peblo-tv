import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import hash_password
from app.db import async_session_maker
from app.models import Artwork, Category, Episode, Season, Show, User
from app.storage import get_storage

LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.WARNING), format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def find_data_dir() -> Path:
    candidates = [
        Path("/app/data"),
        Path("data"),
        Path("../data"),
        Path(__file__).resolve().parent.parent.parent / "data",
    ]
    for p in candidates:
        if p.is_dir() and (p / "reference.json").exists() and (p / "seed_shows.json").exists():
            return p
    raise FileNotFoundError("Could not find data directory with reference.json and seed_shows.json")


def load_reference_and_seed():
    data_dir = find_data_dir()
    with open(data_dir / "reference.json", "r", encoding="utf-8") as f:
        ref = json.load(f)
    with open(data_dir / "seed_shows.json", "r", encoding="utf-8") as f:
        seed = json.load(f)
    return ref, seed


def validate_and_deduplicate(ref: Dict[str, Any], seed: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    valid_sections: Set[str] = set(ref.get("sections", []))
    valid_categories: Set[str] = set(ref.get("categories", []))
    valid_languages: Set[str] = set(ref.get("languages", []))

    cg_lang_map: Dict[tuple, Dict[str, Any]] = {}

    for row in seed:
        section = row.get("section")
        if section is not None and section not in valid_sections:
            raise ValueError(f"Invalid section '{section}' in episode {row.get('episode_id')}")

        for cat in row.get("categories", []):
            if cat not in valid_categories:
                raise ValueError(f"Invalid category '{cat}' in episode {row.get('episode_id')}")

        lang = row.get("language")
        if lang not in valid_languages:
            raise ValueError(f"Invalid language '{lang}' in episode {row.get('episode_id')}")

        cg_key = (row.get("content_group"), lang)
        ep_id = row.get("episode_id")

        if cg_key in cg_lang_map:
            existing = cg_lang_map[cg_key]
            existing_id = existing.get("episode_id")
            if ep_id == "ep_9001" and existing_id == "ep_0004":
                logger.info(
                    "Resolved duplicate (content_group, language) for '%s' + '%s': "
                    "replaced '%s' with newer '%s'.",
                    cg_key[0],
                    cg_key[1],
                    existing_id,
                    ep_id,
                )
                cg_lang_map[cg_key] = row
            else:
                raise ValueError(
                    f"Unexpected duplicate (content_group, language) pair {cg_key} "
                    f"between episode '{existing_id}' and '{ep_id}'"
                )
        else:
            cg_lang_map[cg_key] = row

    deduped_episodes = list(cg_lang_map.values())
    if len(deduped_episodes) != 94:
        logger.warning("Expected 94 deduplicated episodes, got %d", len(deduped_episodes))
    return deduped_episodes


async def seed_database(session: AsyncSession):
    ref, seed_data = load_reference_and_seed()
    clean_episodes = validate_and_deduplicate(ref, seed_data)

    # 1. Sync Reference Categories
    existing_cats = (await session.execute(select(Category))).scalars().all()
    cat_map: Dict[str, Category] = {c.slug: c for c in existing_cats}

    for cat_slug in ref.get("categories", []):
        if cat_slug not in cat_map:
            cat = Category(name=cat_slug, slug=cat_slug)
            session.add(cat)
            await session.flush()
            cat_map[cat_slug] = cat

    # 2. Sync Shows & Categories
    shows_data: Dict[str, Dict[str, Any]] = {}
    for ep in clean_episodes:
        slug = ep["slug"]
        if slug not in shows_data:
            shows_data[slug] = {
                "title": ep["show_title"],
                "slug": slug,
                "section": ep.get("section"),
                "description": ep.get("synopsis"),
                "status": "published" if ep.get("status") == "published" else "draft",
                "categories": ep.get("categories", []),
            }
        elif ep.get("status") == "published":
            shows_data[slug]["status"] = "published"

    existing_shows = (
        (await session.execute(select(Show).options(selectinload(Show.categories)))).scalars().all()
    )
    show_map: Dict[str, Show] = {s.slug: s for s in existing_shows}

    for slug, s_data in shows_data.items():
        matched_cats = [cat_map[c] for c in s_data["categories"] if c in cat_map]
        if slug in show_map:
            show = show_map[slug]
            show.title = s_data["title"]
            show.section = s_data["section"]
            show.description = s_data["description"]
            show.status = s_data["status"]
            show.categories = matched_cats
        else:
            show = Show(
                title=s_data["title"],
                slug=slug,
                section=s_data["section"],
                description=s_data["description"],
                status=s_data["status"],
                categories=matched_cats,
            )
            session.add(show)
            await session.flush()
            show_map[slug] = show

    # 3. Sync Seasons
    seasons_data: Set[tuple] = set((ep["slug"], ep["season_number"]) for ep in clean_episodes)
    existing_seasons = (await session.execute(select(Season))).scalars().all()
    season_map: Dict[tuple, Season] = {(s.show_id, s.season_number): s for s in existing_seasons}

    for slug, s_num in seasons_data:
        show = show_map[slug]
        season_key = (show.id, s_num)
        if season_key not in season_map:
            season = Season(
                show_id=show.id,
                season_number=s_num,
                title=f"Season {s_num}" if s_num > 0 else "Trailers",
            )
            session.add(season)
            await session.flush()
            season_map[season_key] = season

    # 4. Sync Episodes
    existing_eps = (await session.execute(select(Episode))).scalars().all()
    ep_map: Dict[str, Episode] = {e.episode_id: e for e in existing_eps}

    if "ep_0004" in ep_map and "ep_9001" in ep_map:
        raise ValueError(
            "Both 'ep_0004' and 'ep_9001' already exist in the database with the same "
            "(content_group, language). Manual resolution required."
        )

    for ep_row in clean_episodes:
        show = show_map[ep_row["slug"]]
        season = season_map[(show.id, ep_row["season_number"])]
        ep_id = ep_row["episode_id"]

        if ep_id == "ep_9001":
            if "ep_9001" in ep_map:
                ep_obj = ep_map["ep_9001"]
            elif "ep_0004" in ep_map:
                ep_obj = ep_map["ep_0004"]
                ep_obj.episode_id = "ep_9001"
                ep_map["ep_9001"] = ep_obj
                del ep_map["ep_0004"]
            else:
                ep_obj = None
        else:
            ep_obj = ep_map.get(ep_id)

        if ep_obj:
            ep_obj.season_id = season.id
            ep_obj.episode_number = ep_row["episode_number"]
            ep_obj.title = ep_row["episode_title"]
            ep_obj.synopsis = ep_row.get("synopsis")
            ep_obj.duration_seconds = ep_row.get("duration_seconds")
            ep_obj.language = ep_row["language"]
            ep_obj.content_group = ep_row["content_group"]
            ep_obj.status = ep_row.get("status", "draft")
        else:
            ep_obj = Episode(
                episode_id=ep_id,
                season_id=season.id,
                episode_number=ep_row["episode_number"],
                title=ep_row["episode_title"],
                synopsis=ep_row.get("synopsis"),
                duration_seconds=ep_row.get("duration_seconds"),
                language=ep_row["language"],
                content_group=ep_row["content_group"],
                status=ep_row.get("status", "draft"),
            )
            session.add(ep_obj)
            ep_map[ep_id] = ep_obj

    # 5. Sync Development Users (Admin & Editor)
    admin_user = os.getenv("SEED_ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("SEED_ADMIN_PASSWORD", "adminpassword")
    editor_user = os.getenv("SEED_EDITOR_USERNAME", "editor")
    editor_pass = os.getenv("SEED_EDITOR_PASSWORD", "editorpassword")

    existing_users = (await session.execute(select(User))).scalars().all()
    user_map = {u.username: u for u in existing_users}

    if admin_user not in user_map:
        session.add(
            User(
                username=admin_user,
                password_hash=hash_password(admin_pass),
                role="admin",
            )
        )
        user_map[admin_user] = True
    else:
        user_map[admin_user].role = "admin"

    if editor_user not in user_map:
        session.add(
            User(
                username=editor_user,
                password_hash=hash_password(editor_pass),
                role="editor",
            )
        )
    # 6. Seed Provided Artwork Fixtures for Episodes
    storage = get_storage()
    artwork_dir = find_data_dir() / "artwork"
    poster_path = artwork_dir / "poster_good.jpg"
    banner_path = artwork_dir / "banner_good.jpg"
    thumb_path = artwork_dir / "thumb_good.jpg"

    if poster_path.exists() and banner_path.exists() and thumb_path.exists():
        poster_bytes = poster_path.read_bytes()
        banner_bytes = banner_path.read_bytes()
        thumb_bytes = thumb_path.read_bytes()

        existing_arts = (await session.execute(select(Artwork))).scalars().all()
        art_map: Dict[tuple, Artwork] = {(a.episode_id, a.artwork_type): a for a in existing_arts}

        specs = [
            ("poster", poster_bytes, "poster.jpg", 600, 900),
            ("banner", banner_bytes, "banner.jpg", 1280, 720),
            ("thumbnail", thumb_bytes, "thumbnail.jpg", 640, 360),
        ]

        artwork_count = 0
        for ep in ep_map.values():
            for art_type, file_content, filename, width, height in specs:
                storage_file_path = f"artwork/{ep.episode_id}/{filename}"
                await storage.save(storage_file_path, file_content, content_type="image/jpeg")

                key = (ep.id, art_type)
                if key in art_map:
                    art_obj = art_map[key]
                    art_obj.file_path = storage_file_path
                    art_obj.width = width
                    art_obj.height = height
                    art_obj.file_size = len(file_content)
                    art_obj.mime_type = "image/jpeg"
                else:
                    art_obj = Artwork(
                        episode_id=ep.id,
                        artwork_type=art_type,
                        file_path=storage_file_path,
                        width=width,
                        height=height,
                        file_size=len(file_content),
                        mime_type="image/jpeg",
                    )
                    session.add(art_obj)
                    art_map[key] = art_obj
                artwork_count += 1
        logger.info("Seeded %d artwork records across %d episodes.", artwork_count, len(ep_map))

    await session.commit()
    logger.info(
        "Seeding completed successfully: %d categories, %d shows, %d seasons, %d episodes, %d users.",
        len(cat_map),
        len(show_map),
        len(season_map),
        len(clean_episodes),
        len(user_map),
    )


async def main():
    async with async_session_maker() as session:
        await seed_database(session)


if __name__ == "__main__":
    asyncio.run(main())

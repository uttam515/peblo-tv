"""Initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-09-03 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_categories_name"),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )

    op.create_table(
        "shows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("section", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_shows_slug"),
    )
    op.create_index(op.f("ix_shows_section"), "shows", ["section"], unique=False)

    op.create_table(
        "show_categories",
        sa.Column("show_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["show_id"], ["shows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("show_id", "category_id", name="pk_show_categories"),
    )
    op.create_index(
        op.f("ix_show_categories_show_id"),
        "show_categories",
        ["show_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_show_categories_category_id"),
        "show_categories",
        ["category_id"],
        unique=False,
    )

    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("show_id", sa.Integer(), nullable=False),
        sa.Column("season_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["show_id"], ["shows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("show_id", "season_number", name="uq_season_show_number"),
    )
    op.create_index(op.f("ix_seasons_show_id"), "seasons", ["show_id"], unique=False)

    op.create_table(
        "episodes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("episode_id", sa.String(length=100), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("synopsis", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("content_group", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("episode_id", name="uq_episodes_episode_id"),
        sa.UniqueConstraint(
            "content_group", "language", name="uq_episode_content_group_language"
        ),
    )
    op.create_index(
        op.f("ix_episodes_content_group"), "episodes", ["content_group"], unique=False
    )
    op.create_index(op.f("ix_episodes_language"), "episodes", ["language"], unique=False)
    op.create_index(op.f("ix_episodes_season_id"), "episodes", ["season_id"], unique=False)

    op.create_table(
        "artwork",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("episode_id", sa.Integer(), nullable=False),
        sa.Column("artwork_type", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["episode_id"], ["episodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("episode_id", "artwork_type", name="uq_artwork_episode_type"),
    )
    op.create_index(op.f("ix_artwork_episode_id"), "artwork", ["episode_id"], unique=False)

    op.create_table(
        "publish_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("triggered_by", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("catalogue_version", sa.String(length=100), nullable=True),
        sa.Column("shows_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("episodes_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("publish_runs")
    op.drop_index(op.f("ix_artwork_episode_id"), table_name="artwork")
    op.drop_table("artwork")
    op.drop_index(op.f("ix_episodes_season_id"), table_name="episodes")
    op.drop_index(op.f("ix_episodes_language"), table_name="episodes")
    op.drop_index(op.f("ix_episodes_content_group"), table_name="episodes")
    op.drop_table("episodes")
    op.drop_index(op.f("ix_seasons_show_id"), table_name="seasons")
    op.drop_table("seasons")
    op.drop_index(op.f("ix_show_categories_category_id"), table_name="show_categories")
    op.drop_index(op.f("ix_show_categories_show_id"), table_name="show_categories")
    op.drop_table("show_categories")
    op.drop_index(op.f("ix_shows_section"), table_name="shows")
    op.drop_table("shows")
    op.drop_table("categories")

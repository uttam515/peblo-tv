from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class ValidationErrorItem(BaseModel):
    entity_type: str
    entity_id: Any
    title: str
    error: str


class CatalogueEpisode(BaseModel):
    content_group: str
    episode_number: int
    title: str
    synopsis: Optional[str] = None
    duration_seconds: int
    languages: List[str]
    artwork: Dict[str, str]


class CatalogueSeason(BaseModel):
    season_number: int
    title: Optional[str] = None
    episodes: List[CatalogueEpisode]


class CatalogueShow(BaseModel):
    id: int
    title: str
    slug: str
    section: str
    description: Optional[str] = None
    categories: List[str] = []
    seasons: List[CatalogueSeason] = []


class CatalogueSection(BaseModel):
    name: str
    shows: List[CatalogueShow] = []


class CatalogueData(BaseModel):
    sections: List[CatalogueSection]


class PublishResponse(BaseModel):
    status: str
    catalogue_version: Optional[str] = None
    shows_count: int
    episodes_count: int
    catalog: CatalogueData


class PublishRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    triggered_by: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    catalogue_version: Optional[str] = None
    shows_count: int
    episodes_count: int
    summary: Optional[str] = None


class CatalogEntityCounts(BaseModel):
    total: int
    published: int
    draft: int
    unique: Optional[int] = None


class PendingChangeItem(BaseModel):
    show_title: str
    changes: List[str] = []


class PendingChangesSummary(BaseModel):
    shows_changed: int = 0
    episodes_changed: int = 0
    artwork_changed: int = 0
    total_changes: int = 0
    details: List[PendingChangeItem] = []


class CatalogStatusResponse(BaseModel):
    status: str  # "no_catalogue", "live", "changes_pending"
    catalogue_version: Optional[str] = None
    last_published_at: Optional[datetime] = None
    shows_count: CatalogEntityCounts
    episodes_count: CatalogEntityCounts
    live_shows_count: Optional[int] = None
    live_episodes_count: Optional[int] = None
    validation_errors: List[ValidationErrorItem] = []
    pending_changes: Optional[PendingChangesSummary] = None


class PublishSeriesResponse(BaseModel):
    show_id: int
    show_title: str
    show_status: str
    episodes_published_count: int
    message: str




from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

LanguageType = Literal["en", "hi"]
StatusType = Literal["draft", "published"]


class EpisodeCreate(BaseModel):
    episode_id: str = Field(..., min_length=1)
    episode_number: int = Field(..., ge=1)
    title: str = Field(..., min_length=1)
    synopsis: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    language: LanguageType
    content_group: str = Field(..., min_length=1)
    status: StatusType = "draft"

    @model_validator(mode="after")
    def validate_published(self):
        if self.status == "published" and self.duration_seconds is None:
            raise ValueError("Published episode must have duration_seconds")
        return self


class EpisodeUpdate(BaseModel):
    episode_id: Optional[str] = Field(None, min_length=1)
    episode_number: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, min_length=1)
    synopsis: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    language: Optional[LanguageType] = None
    content_group: Optional[str] = Field(None, min_length=1)
    status: Optional[StatusType] = None


class EpisodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_id: str
    season_id: int
    episode_number: int
    title: str
    synopsis: Optional[str] = None
    duration_seconds: Optional[int] = None
    language: str
    content_group: str
    status: str
    created_at: datetime
    updated_at: datetime

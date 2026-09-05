from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SeasonCreate(BaseModel):
    season_number: int = Field(..., ge=0)
    title: Optional[str] = None


class SeasonUpdate(BaseModel):
    season_number: Optional[int] = Field(None, ge=0)
    title: Optional[str] = None


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    show_id: int
    season_number: int
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime

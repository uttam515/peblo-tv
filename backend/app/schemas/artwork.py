from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict

ArtworkType = Literal["poster", "banner", "thumbnail"]


class ArtworkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_id: int
    artwork_type: str
    file_path: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

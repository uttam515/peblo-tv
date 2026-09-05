from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

SectionType = Literal["featured", "series", "minisodes", "songs"]
StatusType = Literal["draft", "published"]


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class ShowCreate(BaseModel):
    title: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    section: Optional[SectionType] = None
    description: Optional[str] = None
    status: StatusType = "draft"


class ShowUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    slug: Optional[str] = Field(None, min_length=1)
    section: Optional[SectionType] = None
    description: Optional[str] = None
    status: Optional[StatusType] = None


class ShowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    section: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    categories: List[CategoryRead] = []


class ShowListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[ShowResponse]

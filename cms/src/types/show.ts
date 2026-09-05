export type SectionType = 'featured' | 'series' | 'minisodes' | 'songs';
export type StatusType = 'draft' | 'published';

export interface CategoryRead {
  id: number;
  name: string;
  slug: string;
}

export interface Show {
  id: number;
  title: string;
  slug: string;
  section: SectionType | null;
  description: string | null;
  status: StatusType;
  created_at: string;
  updated_at: string;
  categories: CategoryRead[];
}

export interface ShowListResponse {
  total: number;
  page: number;
  page_size: number;
  results: Show[];
}

export interface ShowCreatePayload {
  title: string;
  slug: string;
  section?: SectionType | null;
  description?: string | null;
  status?: StatusType;
}

export interface ShowUpdatePayload {
  title?: string;
  slug?: string;
  section?: SectionType | null;
  description?: string | null;
  status?: StatusType;
}

export interface ShowQueryParams {
  q?: string;
  section?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

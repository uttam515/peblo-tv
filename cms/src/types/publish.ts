export interface PublishValidationErrorItem {
  entity_type: 'show' | 'episode' | string;
  entity_id: number | string;
  title: string;
  error: string;
}

export interface PublishErrorDetail {
  message: string;
  errors: PublishValidationErrorItem[];
}

export interface PublishSuccessResponse {
  status: 'success' | string;
  catalogue_version?: string | null;
  shows_count: number;
  episodes_count: number;
  catalog: any;
}

export interface PublishRunRecord {
  id?: number | string;
  status: 'success' | 'failed' | string;
  triggered_by?: string;
  started_at?: string;
  completed_at?: string;
  catalogue_version?: string | null;
  shows_count?: number;
  episodes_count?: number;
  summary?: string;
}

export interface CatalogEntityCounts {
  total: number;
  published: number;
  draft: number;
  unique?: number;
}

export interface PendingChangeItem {
  show_title: string;
  changes: string[];
}

export interface PendingChangesSummary {
  shows_changed: number;
  episodes_changed: number;
  artwork_changed: number;
  total_changes: number;
  details: PendingChangeItem[];
}

export interface CatalogStatusResponse {
  status: 'no_catalogue' | 'live' | 'changes_pending';
  catalogue_version?: string | null;
  last_published_at?: string | null;
  shows_count: CatalogEntityCounts;
  episodes_count: CatalogEntityCounts;
  live_shows_count?: number | null;
  live_episodes_count?: number | null;
  validation_errors: PublishValidationErrorItem[];
  pending_changes?: PendingChangesSummary | null;
}

export interface PublishSeriesResponse {
  show_id: number;
  show_title: string;
  show_status: string;
  episodes_published_count: number;
  message: string;
}


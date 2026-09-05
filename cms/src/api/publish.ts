import { apiClient } from './client';
import {
  PublishSuccessResponse,
  PublishRunRecord,
  CatalogStatusResponse,
} from '../types/publish';

export async function publishCatalog(): Promise<PublishSuccessResponse> {
  return apiClient<PublishSuccessResponse>('/admin/catalog/publish', {
    method: 'POST',
  });
}

export async function getPublishHistory(limit: number = 50): Promise<PublishRunRecord[]> {
  return apiClient<PublishRunRecord[]>(`/admin/catalog/history?limit=${limit}`);
}

export async function getCatalogStatus(): Promise<CatalogStatusResponse> {
  return apiClient<CatalogStatusResponse>('/admin/catalog/status');
}



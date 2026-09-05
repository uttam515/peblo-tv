import { apiClient } from './client';
import { CatalogueData, CatalogSearchParams } from '../types/catalog';

export async function getCatalog(): Promise<CatalogueData> {
  return apiClient<CatalogueData>('/catalog');
}

export async function searchCatalog(params: CatalogSearchParams = {}): Promise<CatalogueData> {
  const searchParams = new URLSearchParams();

  if (params.q?.trim()) {
    searchParams.set('q', params.q.trim());
  }
  if (params.category?.trim()) {
    searchParams.set('category', params.category.trim());
  }
  if (params.language?.trim()) {
    searchParams.set('language', params.language.trim());
  }
  if (params.section?.trim()) {
    searchParams.set('section', params.section.trim());
  }

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/catalog/search?${queryString}` : '/catalog/search';
  return apiClient<CatalogueData>(endpoint);
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    let errorData: any = null;
    try {
      errorData = await response.json();
      if (typeof errorData?.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData?.detail && typeof errorData.detail === 'object' && typeof errorData.detail.message === 'string') {
        errorMessage = errorData.detail.message;
      } else if (errorData?.detail && Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      }
    } catch {
      // response is not json
    }
    throw new ApiError(response.status, errorMessage, errorData);
  }

  return response.json();
}

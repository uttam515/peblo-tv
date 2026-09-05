const TOKEN_STORAGE_KEY = 'peblo_tv_cms_token';
const USER_STORAGE_KEY = 'peblo_tv_cms_user';

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

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getStoredUser(): any | null {
  const data = localStorage.getItem(USER_STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredUser(user: any | null) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setStoredToken(null);
    setStoredUser(null);
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    throw new ApiError(401, 'Session expired or unauthorized. Please log in.');
  }

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

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json();
}

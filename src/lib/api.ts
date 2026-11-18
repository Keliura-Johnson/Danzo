import { firebaseAuth } from '../firebase';

type RequestConfig = {
  params?: Record<string, unknown>;
};

type ApiResponse<T = any> = {
  data: T;
  status: number;
  statusText: string;
};

class ApiRequestError extends Error {
  response: { data: any; status: number; statusText: string };

  constructor(data: any, status: number, statusText: string) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      statusText ||
      'Request failed.';
    super(String(message));
    this.name = 'ApiRequestError';
    this.response = { data, status, statusText };
  }
}

// AppDeploy's API gateway is the default so builds without VITE_API_BASE_URL
// continue to reach the existing AppDeploy backend.
const DEFAULT_API_BASE_URL = 'https://api-v2.appdeploy.ai/app/danzo-h68jin';
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).trim().replace(/\\/+$/, '');

function appendParams(path: string, params?: Record<string, unknown>) {
  if (!params) return path;
  const [pathname, query = ''] = path.split('?');
  const search = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach(item => search.append(key, String(item)));
    } else if (typeof value === 'object') {
      search.set(key, JSON.stringify(value));
    } else {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized ? pathname + '?' + serialized : pathname;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  const url = API_BASE_URL + appendParams(
    path.startsWith('/') ? path : '/' + path,
    config?.params
  );
  const headers: Record<string, string> = { Accept: 'application/json' };

  // Firebase ID tokens are sent only in the Authorization header, never in
  // request bodies or URL query parameters.
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const init: RequestInit = { method, headers };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const raw = await response.text();
  let data: any = undefined;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(data, response.status, response.statusText);
  }

  return {
    data: data as T,
    status: response.status,
    statusText: response.statusText,
  };
}

export const api = {
  get<T = any>(path: string, config?: RequestConfig) {
    return request<T>('GET', path, undefined, config);
  },
  post<T = any>(path: string, data?: unknown) {
    return request<T>('POST', path, data);
  },
  put<T = any>(path: string, data?: unknown) {
    return request<T>('PUT', path, data);
  },
  delete<T = any>(path: string, data?: unknown) {
    return request<T>('DELETE', path, data);
  },
};

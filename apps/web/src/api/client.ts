const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:3000/api/v1'

interface ApiErrorPayload {
  message?: string | string[]
  error?: string
  statusCode?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: ApiErrorPayload | null

  constructor(
    status: number,
    message: string,
    payload: ApiErrorPayload | null,
  ) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function buildErrorMessage(
  status: number,
  payload: ApiErrorPayload | null,
): string {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(', ')
  }

  if (typeof payload?.message === 'string') {
    return payload.message
  }

  if (payload?.error) {
    return payload.error
  }

  return `API request failed with status ${status}.`
}

async function request<T>(
  path: string,
  options: RequestInit,
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (accessToken) {
    headers.set(
      'Authorization',
      `Bearer ${accessToken}`,
    )
  }

  if (
    options.body !== undefined &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
  )

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload =
        (await response.json()) as ApiErrorPayload
    } catch {
      payload = null
    }

    throw new ApiError(
      response.status,
      buildErrorMessage(
        response.status,
        payload,
      ),
      payload,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType =
    response.headers.get('content-type')

  if (
    !contentType?.includes(
      'application/json',
    )
  ) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function publicApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(
    path,
    options,
  )
}

export function apiRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  if (!accessToken.trim()) {
    throw new ApiError(
      401,
      'Cognito access token is required.',
      null,
    )
  }

  return request<T>(
    path,
    options,
    accessToken,
  )
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|;\s*)passway_csrf=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

export async function api<T>(
  path: string,
  opts?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const method = opts?.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (opts?.body !== undefined) headers['content-type'] = 'application/json'
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrf = readCsrfCookie()
    if (csrf) headers['x-csrf-token'] = csrf
  }
  const res = await fetch(path, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const message = (data?.message as string) || `Request failed (${res.status})`
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      // session expired -> bounce to login
      window.dispatchEvent(new CustomEvent('passway:unauthorized'))
    }
    throw new ApiError(message, res.status)
  }
  return data as T
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

import type { ApiEnvelope, BridgeFailure } from '../types/bridge'

/**
 * 渲染层请求适配层。
 *
 * 单机版没有 HTTP 服务：所有请求经 window.lc.call 交给主进程，由主进程里的
 * Hono 路由在进程内处理（不监听端口）。保留 `{ data: 信封 }` 的返回形状和
 * `http.get/post/put/delete` 的调用方式，业务代码不用改写。
 */

export const API_BASE = '/api/v1'

/** 主进程返回的业务错误；message 直接就是给用户看的中文提示 */
export class ApiError extends Error {
  code: number
  data?: unknown

  constructor(message: string, code = 500, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

type QueryParams = Record<string, unknown> | undefined

function withQuery(path: string, params?: QueryParams): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) if (v !== undefined && v !== null) search.append(key, String(v))
    } else {
      search.append(key, String(value))
    }
  }
  const qs = search.toString()
  if (!qs) return path
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`
}

function isFailure(res: ApiEnvelope | BridgeFailure): res is BridgeFailure {
  return (res as BridgeFailure).ok === false
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<{ data: ApiEnvelope<T> }> {
  if (!window.lc?.call) throw new ApiError('桌面宿主未就绪，请重启应用', 500)
  const res = await window.lc.call<T>(method, API_BASE + path, body)
  if (isFailure(res)) throw new ApiError(res.msg || '操作失败', res.code, res.data)
  return { data: res }
}

export const http = {
  get<T = unknown>(path: string, opts?: { params?: QueryParams }) {
    return request<T>('GET', withQuery(path, opts?.params))
  },
  post<T = unknown>(path: string, body?: unknown) {
    return request<T>('POST', path, body)
  },
  put<T = unknown>(path: string, body?: unknown) {
    return request<T>('PUT', path, body)
  },
  delete<T = unknown>(path: string, opts?: { params?: QueryParams; body?: unknown }) {
    return request<T>('DELETE', withQuery(path, opts?.params), opts?.body)
  }
}

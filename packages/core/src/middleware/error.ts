import type { Context, ErrorHandler, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

/** 统一响应信封：{ code, msg, data } */
export interface ApiEnvelope<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 业务错误：携带 HTTP 状态码与业务 code（默认同状态码） */
export class ApiError extends HTTPException {
  constructor(status: ContentfulStatusCode, message: string, code?: number) {
    super(status, { message })
    this.code = code ?? Number(status)
  }
  code: number
}

export const fieldErrorBody = (issues: ZodError['issues']) => ({
  fieldErrors: issues.map((i) => ({
    field: i.path.join('.'),
    message: i.message
  }))
})

export const errorHandler: ErrorHandler = async (err, c) => {
  if (err instanceof ApiError) {
    return c.json({ code: err.code, msg: err.message, data: null }, err.status)
  }
  if (err instanceof HTTPException) {
    return c.json({ code: err.status, msg: err.message || '请求错误', data: null }, err.status)
  }
  if (err instanceof ZodError) {
    return c.json({ code: 400, msg: '参数校验失败', data: fieldErrorBody(err.issues) }, 400)
  }
  console.error('[unhandled]', err)
  return c.json({ code: 500, msg: '服务异常，请稍后重试', data: null }, 500)
}

export const notFoundHandler = (c: Context) =>
  c.json({ code: 404, msg: '资源不存在', data: null }, 404)

export type { MiddlewareHandler }

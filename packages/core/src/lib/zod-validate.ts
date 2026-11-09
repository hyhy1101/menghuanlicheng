import type { Context, ValidationTargets } from 'hono'
import { zValidator as honoZValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'
import { fieldErrorBody } from '../middleware/error.js'

/**
 * 与 @hono/zod-validator 同形校验中间件，但校验失败时返回统一信封
 * `{ code, msg, data }`（默认的 zod-validator 会把 `{ success:false, error }`
 * 原样作为 400 返回，客户端无法读到 msg，导致提示“操作失败，请重试”）。
 * msg 取首个校验 issue 的 message（如“密码长度需在 8~32 位之间”），
 * data.fieldErrors 保留完整逐字段错误。
 */
export function zValidator<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) {
  return honoZValidator(
    target,
    schema,
    async (
      result: { success: true; data: unknown } | { success: false; error: { issues: Array<{ message?: string }> } },
      c: Context
    ) => {
      if (result.success) return undefined
      const first = result.error.issues[0]
      return c.json(
        { code: 400, msg: first?.message ?? '参数校验失败', data: fieldErrorBody(result.error.issues as never) },
        400
      )
    }
  )
}

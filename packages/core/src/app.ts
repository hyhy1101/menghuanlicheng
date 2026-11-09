import { Hono } from 'hono'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { basicRoutes } from './routes/basic.js'
import { sessionRoutes } from './routes/sessions.js'
import { recordRoutes } from './routes/records.js'
import { teamRoutes } from './routes/teams.js'
import { roleRoutes } from './routes/roles.js'
import { statisticsRoutes } from './routes/statistics.js'

/**
 * 应用内路由。
 *
 * 这里没有 HTTP 服务：主进程直接 `app.request(path, init)` 调进来，Hono 只当作
 * 一个「按 URL 分发到业务函数」的进程内路由器用。保留它是因为原服务端 4k 多行
 * 业务逻辑（校验、算钱、事务）可以原样复用，渲染层也沿用原来的 api 封装。
 */
export const app = new Hono()

app.onError(errorHandler)
app.notFound(notFoundHandler)

app.get('/health', (c) => c.json({ code: 200, msg: 'ok', data: null }))

app.route('/api/v1', basicRoutes)
app.route('/api/v1/mileage-sessions', sessionRoutes)
app.route('/api/v1/mileage-records', recordRoutes)
app.route('/api/v1/teams', teamRoutes)
app.route('/api/v1/roles', roleRoutes)
app.route('/api/v1/statistics', statisticsRoutes)

export type ApiApp = typeof app

/**
 * 内置定时活动（有规则 → 会在「活动」页的周视图里排班，并按提醒设置弹通知）。
 *
 * ⚠️ 内置规则只是初始值，一切以游戏内公告为准。
 * ⚠️ 发布前请在这里补齐你要内置的活动；下面只填了两个示例，其余留了空位。
 *
 * 规则写法（rules 是数组，一个活动可以有多条）：
 *   每天：      { type: 'DAILY', start: '10:00', end: '11:00' }
 *   每周固定：  { type: 'WEEKLY', dayOfWeek: 6, start: '10:00', end: '11:30' }
 *               dayOfWeek：0=周日 1=周一 … 6=周六
 *   每月第几周：{ type: 'MONTHLY_NTH', nth: 1, dayOfWeek: 0, start: '15:00', end: '17:00' }
 *               nth：1~4 表示第几周，5 表示「当月最后一个」该星期几
 *   跨零点：    end 小于 start 即视为次日（如 22:30 → 01:00）
 */
import type { SeedSource } from './sources.js'

export const SEED_ACTIVITIES: SeedSource[] = [
  {
    name: '门派闯关',
    type: 'ACTIVITY',
    level: null,
    durationDesc: '15:00~17:00',
    intro: '每月第一个周日 15:00~17:00',
    rules: [{ type: 'MONTHLY_NTH', nth: 1, dayOfWeek: 0, start: '15:00', end: '17:00' }]
  },
  {
    name: '慈心渡鬼',
    type: 'ACTIVITY',
    level: null,
    durationDesc: '10:00~11:30',
    intro: '每周六 10:00~11:30',
    rules: [{ type: 'WEEKLY', dayOfWeek: 6, start: '10:00', end: '11:30' }]
  }

  // ———— 发布前在这里补充其余内置活动，格式同上 ————
  // { name: '彩虹争霸赛', type: 'ACTIVITY', durationDesc: '14:00~17:00', rules: [{ type: 'WEEKLY', dayOfWeek: 6, start: '14:00', end: '17:00' }] },
  // { name: '文韵墨香',   type: 'ACTIVITY', durationDesc: '14:00~17:00', rules: [{ type: 'WEEKLY', dayOfWeek: 6, start: '14:00', end: '17:00' }] },
  // { name: '十二门派',   type: 'ACTIVITY', durationDesc: '19:00~21:00', rules: [{ type: 'WEEKLY', dayOfWeek: 3, start: '19:00', end: '21:00' }] },
  // { name: '帮派竞赛',   type: 'ACTIVITY', durationDesc: '20:00~21:30', rules: [{ type: 'MONTHLY_NTH', nth: 2, dayOfWeek: 6, start: '20:00', end: '21:30' }] }
]

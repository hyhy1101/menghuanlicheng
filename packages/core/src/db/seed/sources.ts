/**
 * 内置玩法/副本种子（无固定时间，不提醒）。
 *
 * 首次启动导入一次，之后用户可在「活动」页自行增删改；升级不会覆盖用户改动。
 */
import type { ActivityRule, SourceType } from '@lc/shared'

export interface SeedSource {
  name: string
  type: SourceType
  level?: number | null
  durationDesc?: string | null
  intro?: string | null
  rules?: ActivityRule[]
}

export const SEED_SOURCES: SeedSource[] = [
  { name: '大闹天宫', type: 'DUNGEON', level: 100, durationDesc: '60~90分钟' },
  { name: '乌鸡国', type: 'DUNGEON', level: 50, durationDesc: '20~30分钟' },
  { name: '石猴授徒', type: 'DUNGEON', level: 50, durationDesc: '20~40分钟' },
  { name: '金兜洞', type: 'DUNGEON', level: 50, durationDesc: '20~40分钟' },
  { name: '通天河', type: 'DUNGEON', level: 120, durationDesc: '60~90分钟' },
  { name: '九色鹿上', type: 'DUNGEON', level: 50, durationDesc: '20~30分钟' },
  { name: '抓鬼', type: 'DAILY', level: 40, durationDesc: '随队' },
  { name: '师门任务', type: 'DAILY', level: 30, durationDesc: '10~20分钟' },
  { name: '打图', type: 'DAILY', level: 40, durationDesc: '随队' },
  { name: '跑环', type: 'DAILY', level: 60, durationDesc: '长周期' },
  { name: '帮派任务', type: 'GUILD', level: 30, durationDesc: '10~20分钟' },
  { name: '周末活动（通用）', type: 'WEEKEND', level: null, durationDesc: '以游戏内公告为准' }
]

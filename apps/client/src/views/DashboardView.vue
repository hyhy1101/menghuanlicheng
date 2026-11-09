<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ActivityOccurrenceDTO, DailySummaryDTO, IncomeTrendPoint } from '@lc/shared'
import { statisticsApi } from '../api/dashboard'
import { activityApi } from '../api/basic'
import { useRecordStore } from '../stores/record'
import { fmtWan } from '../utils/format'
import { formatLocalDate, formatLocalMonth } from '../utils/date'
import CardHeader from '../components/CardHeader.vue'
import IncomeChart from '../components/IncomeChart.vue'

const router = useRouter()
const record = useRecordStore()

const summary = ref<DailySummaryDTO | null>(null)
const trend = ref<IncomeTrendPoint[]>([])
const todayActivities = ref<ActivityOccurrenceDTO[]>([])
const cycle = ref<'WEEK' | 'MONTH' | 'YEAR'>('MONTH')

const today = formatLocalDate()

const nextActivity = computed(() => {
  const now = new Date()
  return (
    todayActivities.value.find((a) => {
      const end = a.end.replace(' ', 'T')
      return new Date(end).getTime() > now.getTime()
    }) ?? null
  )
})

function cycleDate(): string {
  if (cycle.value === 'WEEK') return formatLocalDate()
  if (cycle.value === 'MONTH') return formatLocalMonth()
  return String(new Date().getFullYear())
}

async function loadTrend() {
  const { data } = await statisticsApi.incomeTrend(cycle.value, cycleDate())
  trend.value = data.data
}

async function loadSummary() {
  const { data } = await statisticsApi.dailySummary(formatLocalDate())
  summary.value = data.data
  if (summary.value?.activeSessionCount) await record.restore()
}

async function loadActivities() {
  const { data } = await activityApi.upcoming(today, 1)
  todayActivities.value = data.data
}

function openActivity(a: ActivityOccurrenceDTO) {
  void router.push({ path: '/record', query: { sourceId: String(a.sourceId), sourceName: a.sourceName } })
}

function timeText(a: ActivityOccurrenceDTO): string {
  return `${a.start.slice(11, 16)}–${a.end.slice(11, 16)}${a.endsNextDay ? '（次日）' : ''}`
}

function startRecord() {
  void router.push('/record')
}

onMounted(async () => {
  await Promise.all([loadTrend(), loadSummary(), loadActivities()])
})
</script>

<template>
  <div class="dashboard">
    <div class="top-grid">
      <div class="card activity-card">
        <CardHeader icon="M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z">
          <template #title>今日活动</template>
          <template #extra>
            <el-button link type="primary" @click="router.push('/activities')">全部</el-button>
          </template>
        </CardHeader>
        <div v-if="nextActivity" class="next">
          <span class="next-label">下一场</span>
          <span class="next-name">{{ nextActivity.sourceName }}</span>
          <span class="next-time num">{{ timeText(nextActivity) }}</span>
        </div>
        <div
          v-for="a in todayActivities"
          :key="`${a.sourceId}-${a.start}`"
          class="activity"
          @click="openActivity(a)"
        >
          <span class="dot" />
          <span class="a-name">{{ a.sourceName }}</span>
          <span class="a-time num">{{ timeText(a) }}</span>
        </div>
        <el-empty v-if="!todayActivities.length" description="今天没有配置定时活动" :image-size="60" />
        <p class="hint activity-hint">活动规则可在「活动」页维护，点击活动会预选到记录页。</p>
      </div>

      <div class="card overview">
        <CardHeader icon="M3 17 9 11l4 4 8-8M21 7h-5v5">
          <template #title>今日概览</template>
          <template #extra>
            <span v-if="(summary?.activeSessionCount ?? 0) > 0" class="live-tag">
              <span class="live-dot" />
              <template v-if="(summary?.activeSessionCount ?? 0) > 1">
                记录中 · {{ summary?.activeSessionCount }} 个号组
              </template>
              <template v-else>记录中</template>
            </span>
          </template>
        </CardHeader>
        <div class="hero-net">
          <div class="hero-label">今日净收益</div>
          <div class="hero-value num" :class="(summary?.netIncome ?? 0) >= 0 ? 'up' : 'down'">
            {{ fmtWan(summary?.netIncome ?? 0) }}<span class="unit">万</span>
          </div>
        </div>
        <div class="stats4">
          <div class="stat">
            <span>今日收益</span>
            <b class="num gold">{{ fmtWan(summary?.totalIncome ?? 0) }}万</b>
          </div>
          <div class="stat">
            <span>今日时长</span>
            <b class="num">{{ ((summary?.durationMinutes ?? 0) / 60).toFixed(1) }}h</b>
          </div>
          <div class="stat">
            <span>今日效率</span>
            <b class="num">{{ fmtWan(summary?.efficiency ?? 0) }}万/h</b>
          </div>
          <div class="stat">
            <span>记录条数</span>
            <b class="num">{{ summary?.recordCount ?? 0 }}</b>
          </div>
        </div>
        <el-button type="primary" class="start-btn" @click="startRecord">
          <template v-if="record.isRecording">
            <span class="rec-pulse" />
            <template v-if="record.activeCount > 1">
              记录中 {{ record.activeCount }} 个号组 · {{ record.elapsedSeconds }}s
            </template>
            <template v-else>记录中... {{ record.elapsedSeconds }}s</template>
          </template>
          <template v-else>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            开始今日里程
          </template>
        </el-button>
      </div>
    </div>

    <div class="card">
      <CardHeader icon="M4 19V5m5 14V9m5 10V3m5 16v-7">
        <template #title>个人收益曲线</template>
        <template #extra>
          <el-segmented
            v-model="cycle"
            class="cycle-seg"
            :options="[
              { label: '周', value: 'WEEK' },
              { label: '月', value: 'MONTH' },
              { label: '年', value: 'YEAR' }
            ]"
            @change="loadTrend"
          />
        </template>
      </CardHeader>
      <IncomeChart :points="trend" />
    </div>

    <div class="card">
      <CardHeader icon="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"><template #title>快捷入口</template></CardHeader>
      <div class="quick-grid">
        <el-button class="quick" @click="router.push('/analysis')">
          <span class="quick-name">收益分析</span>
          <span class="quick-desc">每日 · 活动 · 物品对比</span>
        </el-button>
        <el-button class="quick" @click="router.push('/teams')">
          <span class="quick-name">号组</span>
          <span class="quick-desc">角色档案 · 组间对比</span>
        </el-button>
        <el-button class="quick" @click="router.push('/items')">
          <span class="quick-name">物品信息</span>
          <span class="quick-desc">三档价格 · 图标</span>
        </el-button>
        <el-button class="quick" @click="router.push('/activities')">
          <span class="quick-name">活动</span>
          <span class="quick-desc">本周时间表 · 提醒</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}
.top-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 18px;
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.card:hover {
  border-color: var(--border-strong);
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}
.activity-card {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}
.next {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
  margin-bottom: 10px;
}
.next-label {
  font-size: 11px;
  color: var(--accent-600);
}
.next-name {
  font-weight: 700;
}
.next-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
}
.activity {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.activity:hover {
  background: var(--bg-raised);
  color: var(--accent-400);
}
.a-name {
  flex: 1;
}
.a-time {
  color: var(--text-muted);
  font-size: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent-500);
  box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.7);
}
.activity-hint {
  margin-top: auto;
  padding-top: 12px;
}
.overview {
  position: relative;
  overflow: hidden;
}
.overview::after {
  content: '';
  position: absolute;
  right: -70px;
  top: -70px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.1), transparent 70%);
  pointer-events: none;
}
.live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--positive);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  background: rgb(var(--accent-rgb) / 0.08);
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--positive);
  animation: breathe 1.6s infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.hero-net {
  margin-bottom: 14px;
}
.hero-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
.hero-value {
  font-size: 40px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.hero-value .unit {
  font-size: 18px;
  font-weight: 600;
  margin-left: 3px;
}
.hero-value.up {
  color: var(--accent-500);
  text-shadow: 0 0 24px rgb(var(--accent-rgb) / 0.35);
}
.hero-value.down {
  color: var(--negative);
}
.stats4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.stat {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: border-color 0.15s;
}
.stat:hover {
  border-color: rgb(var(--accent-rgb) / 0.3);
}
.stat span {
  font-size: 11px;
  color: var(--text-muted);
}
.stat b {
  font-size: 17px;
}
.gold {
  color: var(--accent-500);
}
.start-btn {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 11px;
  background: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  color: var(--on-accent);
  box-shadow: 0 4px 20px rgb(var(--accent-rgb) / 0.35);
}
.start-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 26px rgb(var(--accent-rgb) / 0.45);
  background: var(--btn-accent-bg);
  color: var(--on-accent);
}
.rec-pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--on-accent);
  animation: breathe 1.2s infinite;
}
.cycle-seg {
  --el-segmented-bg-color: var(--bg-input);
  --el-segmented-item-selected-bg-color: var(--accent-500);
  --el-segmented-item-selected-color: var(--on-accent);
  --el-segmented-item-hover-bg-color: var(--bg-raised);
  --el-segmented-item-color: var(--text-muted);
  --el-segmented-item-hover-color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
}
.cycle-seg :deep(.el-segmented__item) {
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 7px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.quick {
  height: 84px;
  margin: 0;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-raised), var(--bg-card));
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}
.quick:hover {
  border-color: rgb(var(--accent-rgb) / 0.45);
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hover);
  background: linear-gradient(180deg, var(--bg-raised), var(--bg-card));
  color: var(--text-secondary);
}
.quick-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.quick-desc {
  font-size: 11px;
  color: var(--text-muted);
}
</style>

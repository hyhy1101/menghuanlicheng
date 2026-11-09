<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { IncomeTrendPoint, ItemAcquisitionItem, SourceRankingItem } from '@lc/shared'
import { statisticsApi } from '../api/dashboard'
import { fmtWan } from '../utils/format'
import { formatLocalDate, formatLocalMonth } from '../utils/date'
import CardHeader from '../components/CardHeader.vue'
import CompareBarChart from '../components/CompareBarChart.vue'

type CompareRange = 'THIS_WEEK' | 'THIS_MONTH'
type RankingRange = 'THIS_WEEK' | 'THIS_MONTH' | 'ALL'

const tab = ref<'compare' | 'rank'>('compare')
const compareRange = ref<CompareRange>('THIS_WEEK')
const compareLoading = ref(false)
const dailyMetric = ref<'net' | 'total'>('net')
const sourceMetric = ref<'total' | 'hourly'>('total')
const itemMetric = ref<'value' | 'quantity' | 'count'>('value')

const trend = ref<IncomeTrendPoint[]>([])
const sources = ref<SourceRankingItem[]>([])
const acquisition = ref<ItemAcquisitionItem[]>([])

const range = ref<RankingRange>('THIS_WEEK')
const ranking = ref<SourceRankingItem[]>([])

const typeName: Record<string, string> = { DUNGEON: '副本', GUILD: '帮派', ACTIVITY: '活动', DAILY: '日常', WEEKEND: '周末', CUSTOM: '自定义' }
const trendText: Record<string, string> = { UP: '▲ 上升', DOWN: '▾ 下降', STABLE: '— 稳定' }

async function loadCompare() {
  compareLoading.value = true
  try {
    // income-trend 用 WEEK/MONTH，source-ranking / item-acquisition 用 THIS_WEEK/THIS_MONTH
    const cycle = compareRange.value === 'THIS_WEEK' ? 'WEEK' : 'MONTH'
    const date = compareRange.value === 'THIS_WEEK' ? formatLocalDate() : formatLocalMonth()
    const [t, s, a] = await Promise.all([
      statisticsApi.incomeTrend(cycle, date),
      statisticsApi.sourceRanking(compareRange.value, 20),
      statisticsApi.itemAcquisition(compareRange.value, 20)
    ])
    trend.value = t.data.data
    sources.value = s.data.data
    acquisition.value = a.data.data
  } finally {
    compareLoading.value = false
  }
}

async function loadRanking() {
  const { data } = await statisticsApi.sourceRanking(range.value)
  ranking.value = data.data
}

function switchTab(t: 'compare' | 'rank') {
  tab.value = t
  if (t === 'compare') void loadCompare()
}

const dailyItems = computed(() =>
  trend.value.map((p) => ({
    name: p.date.slice(5),
    value: dailyMetric.value === 'net' ? p.netIncome : p.totalIncome
  }))
)
const hasDailyData = computed(() => trend.value.some((p) => p.recordCount > 0))
const dailyHeight = computed(() => Math.min(560, Math.max(240, dailyItems.value.length * 22)))

const sourceItems = computed(() =>
  sources.value
    .map((s) => ({
      name: s.sourceName,
      value: sourceMetric.value === 'total' ? s.totalNetIncome : s.avgNetIncomePerHour
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15)
)
const sourceHeight = computed(() => Math.min(420, Math.max(200, sourceItems.value.length * 28)))

function itemValueOf(i: ItemAcquisitionItem): number {
  if (itemMetric.value === 'value') return i.itemValue
  if (itemMetric.value === 'quantity') return i.quantity
  return i.recordCount
}
const itemItems = computed(() =>
  acquisition.value
    .map((i) => ({ name: i.itemName, value: itemValueOf(i) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15)
)
const itemHeight = computed(() => Math.min(420, Math.max(200, itemItems.value.length * 28)))

const wan = (v: number) => `${fmtWan(v)}万`
const wanPerHour = (v: number) => `${fmtWan(v)}万/h`
const quantityText = (v: number) => `${v.toLocaleString('zh-CN')} 个`
const countText = (v: number) => `${v.toLocaleString('zh-CN')} 次`
const itemFormatter = computed(() =>
  itemMetric.value === 'value' ? wan : itemMetric.value === 'quantity' ? quantityText : countText
)
const sourceFormatter = computed(() => (sourceMetric.value === 'total' ? wan : wanPerHour))

onMounted(() => {
  void Promise.all([loadCompare(), loadRanking()])
})
</script>

<template>
  <div class="analysis-page">
    <el-tabs v-model="tab" class="ana-tabs" @tab-change="switchTab($event as 'compare' | 'rank')">
      <el-tab-pane label="对比分析" name="compare" />
      <el-tab-pane label="玩法收益率排行" name="rank" />
    </el-tabs>

    <div v-if="tab === 'compare'" v-loading="compareLoading" class="compare-page">
      <div class="compare-toolbar">
        <el-segmented
          v-model="compareRange"
          class="range-seg"
          :options="[
            { label: '本周', value: 'THIS_WEEK' },
            { label: '本月', value: 'THIS_MONTH' }
          ]"
          @change="loadCompare"
        />
        <span class="hint">横向条形图，按数值从大到小排列</span>
      </div>

      <div class="card">
        <CardHeader icon="M4 19V5m5 14V9m5 10V3m5 16v-7">
          <template #title>每日收益对比 <span class="hint">净收益 = 收益 - 成本</span></template>
          <template #extra>
            <el-segmented
              v-model="dailyMetric"
              class="range-seg"
              :options="[
                { label: '净收益', value: 'net' },
                { label: '总收益', value: 'total' }
              ]"
            />
          </template>
        </CardHeader>
        <CompareBarChart
          v-if="hasDailyData"
          :items="dailyItems"
          :height="dailyHeight"
          :value-formatter="wan"
          diverging
        />
        <el-empty
          v-else
          :description="`${compareRange === 'THIS_WEEK' ? '本周' : '本月'}暂无记录`"
          :image-size="60"
        />
      </div>

      <div class="card">
        <CardHeader icon="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z">
          <template #title>活动收益对比 <span class="hint">按主来源归属，已剔除异常值</span></template>
          <template #extra>
            <el-segmented
              v-model="sourceMetric"
              class="range-seg"
              :options="[
                { label: '总净收益', value: 'total' },
                { label: '每小时', value: 'hourly' }
              ]"
            />
          </template>
        </CardHeader>
        <CompareBarChart
          v-if="sourceItems.length"
          :items="sourceItems"
          :height="sourceHeight"
          :value-formatter="sourceFormatter"
          diverging
        />
        <el-empty v-else description="暂无活动收益，完成记账后自动生成" :image-size="60" />
        <p class="chart-note">未标记来源的记录不计入本图。</p>
      </div>

      <div class="card">
        <CardHeader icon="M20 7 9 18l-5-5">
          <template #title>物品获取对比 <span class="hint">仅统计收益明细，Top 15</span></template>
          <template #extra>
            <el-segmented
              v-model="itemMetric"
              class="range-seg"
              :options="[
                { label: '收益', value: 'value' },
                { label: '数量', value: 'quantity' },
                { label: '次数', value: 'count' }
              ]"
            />
          </template>
        </CardHeader>
        <CompareBarChart
          v-if="itemItems.length"
          :items="itemItems"
          :height="itemHeight"
          :value-formatter="itemFormatter"
        />
        <el-empty v-else description="暂无物品获取记录" :image-size="60" />
        <p class="chart-note">按物品汇总：收益为物品价值合计，次数为出现的记录数。</p>
      </div>
    </div>

    <div v-else class="card">
      <CardHeader icon="M3 17 9 11l4 4 8-8M21 7h-5v5">
        <template #title>玩法收益率排行 <span class="hint">最近N次均值，已剔除异常值</span></template>
        <template #extra>
          <el-segmented
            v-model="range"
            class="range-seg"
            :options="[
              { label: '本周', value: 'THIS_WEEK' },
              { label: '本月', value: 'THIS_MONTH' },
              { label: '全部', value: 'ALL' }
            ]"
            @change="loadRanking"
          />
        </template>
      </CardHeader>
      <el-table :data="ranking" class="lc-table">
        <el-table-column label="#" width="56">
          <template #default="{ $index }">
            <span class="rank" :class="{ top: $index === 0 }">{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="玩法" min-width="130">
          <template #default="{ row }">
            <span class="src-name">{{ row.sourceName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag class="type-tag" :class="row.sourceType.toLowerCase()" size="small">
              {{ typeName[row.sourceType] ?? row.sourceType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="净收益/h" width="130">
          <template #default="{ row }">
            <span class="gold num">{{ fmtWan(row.avgNetIncomePerHour) }}万</span>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="次数" width="90" />
        <el-table-column label="趋势" min-width="100">
          <template #default="{ row }">
            <span class="trend" :class="row.trend">{{ trendText[row.trend] }}</span>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据，完成里程记录后自动生成" :image-size="60" /></template>
      </el-table>
    </div>

  </div>
</template>

<style scoped>
.analysis-page {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.compare-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.chart-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
/* el-tabs 金色激活 */
.ana-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  color: var(--text-muted);
}
.ana-tabs :deep(.el-tabs__item.is-active) {
  color: var(--accent-400);
  font-weight: 600;
}
.ana-tabs :deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, var(--accent-400), var(--accent-600));
  box-shadow: 0 0 8px rgb(var(--accent-rgb) / 0.5);
  height: 2px;
  border-radius: 2px;
}
.ana-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--border);
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 18px;
  box-shadow: var(--card-shadow);
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
  margin-left: 4px;
}
.range-seg {
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
.range-seg :deep(.el-segmented__item) {
  font-size: 12.5px;
  padding: 5px 13px;
  border-radius: 7px;
}
/* el-table 暗色适配 */
.lc-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
  --el-table-border-color: var(--border);
  --el-table-header-text-color: var(--text-muted);
  --el-table-text-color: var(--text-primary);
  font-size: 13px;
}
.lc-table :deep(th.el-table__cell) {
  font-size: 12px;
  letter-spacing: 0.3px;
  font-weight: 500;
}
.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-raised);
  color: var(--text-muted);
  border: 1px solid var(--border);
}
.rank.top {
  background: linear-gradient(135deg, var(--accent-500), var(--accent-600));
  color: var(--on-accent);
  border-color: transparent;
}
.src-name {
  font-weight: 600;
}
.gold {
  color: var(--accent-500);
}
.green {
  color: var(--positive);
}
.trend {
  font-size: 12.5px;
}
.trend.UP {
  color: var(--positive);
}
.trend.DOWN {
  color: var(--negative);
}
.trend.STABLE {
  color: var(--text-muted);
}
/* el-tag 语义色 */
.type-tag {
  --el-tag-bg-color: var(--bg-raised);
  --el-tag-border-color: var(--border);
  --el-tag-text-color: var(--text-secondary);
  border-radius: 20px;
}
.type-tag.dungeon {
  --el-tag-bg-color: color-mix(in srgb, var(--info) 12%, transparent);
  --el-tag-border-color: color-mix(in srgb, var(--info) 38%, transparent);
  --el-tag-text-color: var(--info);
}
.type-tag.activity {
  --el-tag-bg-color: rgb(var(--accent-rgb) / 0.1);
  --el-tag-border-color: rgb(var(--accent-rgb) / 0.35);
  --el-tag-text-color: var(--accent-400);
}
.type-tag.daily {
  --el-tag-bg-color: rgba(61, 214, 140, 0.1);
  --el-tag-border-color: rgba(61, 214, 140, 0.35);
  --el-tag-text-color: var(--positive);
}
</style>

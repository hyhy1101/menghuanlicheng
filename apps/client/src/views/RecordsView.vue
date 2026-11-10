<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { MileageRecordDTO } from '@lc/shared'
import { recordsApi } from '../api/records'
import { fmtWan } from '../utils/format'
import { formatLocalDate } from '../utils/date'
import CardHeader from '../components/CardHeader.vue'

const list = ref<MileageRecordDTO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const keyword = ref('')
const dateRange = ref<[string, string] | null>(null)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<MileageRecordDTO | null>(null)

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatLocalDate(d)
}

function presetToday() {
  const today = formatLocalDate()
  dateRange.value = [today, today]
  page.value = 1
  void load()
}

function presetDays(n: number) {
  dateRange.value = [daysAgo(n), formatLocalDate()]
  page.value = 1
  void load()
}

function presetMonth() {
  const d = new Date()
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  dateRange.value = [first, formatLocalDate()]
  page.value = 1
  void load()
}

function onRangeChange() {
  page.value = 1
  void load()
}

async function load() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (dateRange.value) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const { data } = await recordsApi.list(params)
    list.value = data.data.list
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  void load()
}

function timeOf(dt: string): string {
  return dt.slice(11, 16)
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? `${m}m` : ''}` : `${m}m`
}

const pageNet = computed(() => list.value.reduce((sum, r) => sum + r.netIncome, 0))

async function openDetail(row: MileageRecordDTO) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const { data } = await recordsApi.detail(row.id)
    detail.value = data.data
  } finally {
    detailLoading.value = false
  }
}

/* ---------------- 导出 CSV ---------------- */

const exporting = ref(false)

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

async function exportCsv() {
  exporting.value = true
  try {
    const rows: MileageRecordDTO[] = []
    const size = 100
    for (let p = 1; p <= 200; p++) {
      const params: Record<string, unknown> = { page: p, pageSize: size }
      if (keyword.value.trim()) params.keyword = keyword.value.trim()
      if (dateRange.value) {
        params.startDate = dateRange.value[0]
        params.endDate = dateRange.value[1]
      }
      const { data } = await recordsApi.list(params)
      rows.push(...data.data.list)
      if (rows.length >= data.data.total || data.data.list.length < size) break
    }
    if (!rows.length) {
      ElMessage.warning('当前筛选条件下没有记录')
      return
    }

    const header = [
      '日期', '开始时间', '结束时间', '时长(分钟)', '服务器', '号组', '角色',
      '物品', '玩法', '方向', '数量', '单价(两)', '金额(两)',
      '记录总银两', '记录物品收益', '点卡成本', '亏损', '净收益', '效率(两/小时)'
    ]
    const lines = [header.map(csvCell).join(',')]
    for (const r of rows) {
      const base = [
        r.belongDate, r.startTime, r.endTime, r.durationMinutes,
        r.serverName ?? '', r.teamName ?? '', r.roleName ?? ''
      ]
      const tail = [r.totalSilver, r.itemSum, r.cardCost, r.lossTotal, r.netIncome, r.efficiency]
      if (!r.details.length) {
        lines.push([...base, '', '', '', '', '', '', ...tail].map(csvCell).join(','))
        continue
      }
      for (const d of r.details) {
        lines.push(
          [
            ...base,
            d.itemName ?? '',
            d.source?.name ?? '',
            d.direction === 'COST' ? '支出' : '收入',
            d.direction === 'COST' ? '' : d.quantity,
            d.unitPrice,
            d.itemValue,
            ...tail
          ]
            .map(csvCell)
            .join(',')
        )
      }
    }

    const tag = dateRange.value ? `${dateRange.value[0]}_${dateRange.value[1]}` : '全部'
    const res = await window.lc.saveText(`梦幻里程-记录-${tag}.csv`, lines.join('\r\n'))
    if (!res.ok) {
      if (res.msg && res.msg !== '已取消') ElMessage.error(res.msg)
      return
    }
    ElMessage.success(`已导出 ${rows.length} 条记录到 ${res.data}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    exporting.value = false
  }
}

/* ---------------- 清理记录 ---------------- */

const clearVisible = ref(false)
const clearing = ref(false)
const clearScope = ref<'filter' | 'all'>('filter')
/** 全部记录的条数，进弹窗时查一次 */
const allTotal = ref(0)

const hasFilter = computed(() => Boolean(dateRange.value) || Boolean(keyword.value.trim()))

const filterDesc = computed(() => {
  const parts = [dateRange.value ? `${dateRange.value[0]} 至 ${dateRange.value[1]}` : '全部日期']
  if (keyword.value.trim()) parts.push(`物品含「${keyword.value.trim()}」`)
  return parts.join(' · ')
})

const clearCount = computed(() => (clearScope.value === 'filter' ? total.value : allTotal.value))

async function openClear() {
  clearScope.value = hasFilter.value ? 'filter' : 'all'
  try {
    const { data } = await recordsApi.list({ page: 1, pageSize: 1 })
    allTotal.value = data.data.total
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  clearVisible.value = true
}

async function doClear() {
  const count = clearCount.value
  if (!count) return
  const what =
    clearScope.value === 'filter'
      ? `当前筛选范围（${filterDesc.value}）内的 ${count} 条`
      : `全部 ${count} 条`
  try {
    await ElMessageBox.confirm(
      `将永久删除${what}已结算记录，日统计会一并重算，删除后无法恢复。`,
      '确认清理',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  clearing.value = true
  try {
    const { data } = await recordsApi.clear(
      clearScope.value === 'all'
        ? { all: true }
        : {
            startDate: dateRange.value?.[0],
            endDate: dateRange.value?.[1],
            keyword: keyword.value.trim() || undefined
          }
    )
    clearVisible.value = false
    page.value = 1
    const { data: after } = await recordsApi.list({ page: 1, pageSize: 1 })
    allTotal.value = after.data.total
    await load()
    ElMessage.success(`已清理 ${data.data.deleted} 条记录`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    clearing.value = false
  }
}

onMounted(presetToday)
</script>

<template>
  <div class="records-page">
    <div class="card">
      <CardHeader icon="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01">
        <template #title>记录查询</template>
        <template #extra>
          <span class="hint">按日期 / 物品关键字检索里程记录</span>
        </template>
      </CardHeader>

      <div class="filter-bar">
        <el-button-group class="preset">
          <el-button size="small" @click="presetToday">本日</el-button>
          <el-button size="small" @click="presetDays(6)">近7天</el-button>
          <el-button size="small" @click="presetMonth">本月</el-button>
        </el-button-group>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="range-picker"
          @change="onRangeChange"
        />
        <el-input
          v-model="keyword"
          placeholder="物品关键字，回车查询"
          clearable
          class="kw-input"
          @keyup.enter="onRangeChange"
          @clear="onRangeChange"
        />
        <el-button type="primary" :loading="loading" @click="onRangeChange">查询</el-button>
        <el-button :loading="exporting" @click="exportCsv">导出 CSV</el-button>
        <el-button class="clear-entry" @click="openClear">清理记录</el-button>
      </div>

      <div class="summary">
        共 <b class="num">{{ total }}</b> 条
        <span v-if="list.length" class="sep">·</span>
        <span v-if="list.length" class="net" :class="pageNet >= 0 ? 'gold' : 'neg'">
          本页净收益 <b class="num">{{ fmtWan(pageNet) }}万</b>
        </span>
      </div>

      <el-table v-loading="loading" :data="list" class="lc-table">
        <el-table-column label="日期" width="100">
          <template #default="{ row }">
            <span class="date-cell num">{{ row.belongDate.slice(5) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="120">
          <template #default="{ row }">
            <span class="time-cell num">{{ timeOf(row.startTime) }} - {{ timeOf(row.endTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="70">
          <template #default="{ row }">
            <span class="num">{{ fmtDuration(row.durationMinutes) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="归属" min-width="120">
          <template #default="{ row }">
            <span class="owner">{{ row.serverName ?? '-' }}</span>
            <span v-if="row.teamName || row.roleName" class="owner-sub">{{ row.teamName ?? row.roleName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="总银两" width="100" align="right">
          <template #default="{ row }">
            <span class="num">{{ fmtWan(row.totalSilver) }}万</span>
          </template>
        </el-table-column>
        <el-table-column label="物品收益" width="100" align="right">
          <template #default="{ row }">
            <span class="num gold">{{ fmtWan(row.itemSum) }}万</span>
          </template>
        </el-table-column>
        <el-table-column label="净收益" width="100" align="right">
          <template #default="{ row }">
            <span class="num" :class="row.netIncome >= 0 ? 'gold' : 'neg'">{{ fmtWan(row.netIncome) }}万</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="76">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="当前筛选条件下暂无记录" :image-size="60" /></template>
      </el-table>

      <div v-if="total > pageSize" class="pager">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <!-- 清理记录 -->
    <el-dialog v-model="clearVisible" title="清理记录信息" width="480px" align-center>
      <div class="clear-body">
        <p class="clear-lead">只清理已结算的里程记录，进行中的场次不受影响；清理后日统计会自动重算。</p>

        <el-radio-group v-model="clearScope" class="clear-scope">
          <el-radio value="filter" :disabled="!hasFilter">
            当前筛选范围
            <span class="scope-meta">{{ filterDesc }} · {{ total }} 条</span>
          </el-radio>
          <el-radio value="all">
            全部记录
            <span class="scope-meta">所有日期 · {{ allTotal }} 条</span>
          </el-radio>
        </el-radio-group>

        <p class="clear-tip">删除后无法撤销。想留底可以先到「关于 / 备份」导出备份，每天首次启动也会自动备份一份。</p>
      </div>
      <template #footer>
        <el-button @click="clearVisible = false">取消</el-button>
        <el-button
          type="danger"
          :loading="clearing"
          :disabled="clearCount === 0"
          @click="doClear"
        >
          清理 {{ clearCount }} 条
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailVisible"
      title="里程记录详情"
      width="680px"
      align-center
    >
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <div class="detail-head">
            <div class="head-main">
              <span class="head-date num">{{ detail.belongDate }}</span>
              <span class="head-time num">{{ timeOf(detail.startTime) }} - {{ timeOf(detail.endTime) }} · {{ fmtDuration(detail.durationMinutes) }}</span>
            </div>
            <div class="head-owner">
              <span class="owner">{{ detail.serverName ?? '-' }}</span>
              <span v-if="detail.teamName || detail.roleName" class="owner-sub">{{ detail.teamName ?? detail.roleName }}</span>
            </div>
          </div>

          <el-table :data="detail.details" class="lc-table detail-table">
            <el-table-column label="物品" min-width="140">
              <template #default="{ row }">
                <span class="item-name">{{ row.itemName ?? `物品#${row.itemId}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="玩法" width="120">
              <template #default="{ row }">
                <span class="item-src">{{ row.source?.name ?? '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="70" align="right">
              <template #default="{ row }">
                <!-- 损耗只有一笔金额，没有数量 -->
                <span class="num">{{ row.direction === 'COST' ? '—' : `×${row.quantity}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="90" align="right">
              <template #default="{ row }">
                <span class="num">{{ fmtWan(row.unitPrice) }}万</span>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="100" align="right">
              <template #default="{ row }">
                <span class="num" :class="row.itemValue >= 0 ? 'gold' : 'neg'">{{ fmtWan(row.itemValue) }}万</span>
              </template>
            </el-table-column>
            <template #empty><el-empty description="无明细" :image-size="50" /></template>
          </el-table>

          <div class="detail-totals">
            <div class="t-item"><span>总银两</span><b class="num">{{ fmtWan(detail.totalSilver) }}万</b></div>
            <div class="t-item"><span>物品收益</span><b class="num gold">{{ fmtWan(detail.itemSum) }}万</b></div>
            <div class="t-item"><span>总收入</span><b class="num">{{ fmtWan(detail.totalIncome) }}万</b></div>
            <div class="t-item"><span>点卡</span><b class="num">{{ fmtWan(detail.cardCost) }}万</b></div>
            <div class="t-item"><span>亏损</span><b class="num">{{ fmtWan(detail.lossTotal) }}万</b></div>
            <div class="t-item net"><span>净收益</span><b class="num" :class="detail.netIncome >= 0 ? 'gold' : 'neg'">{{ fmtWan(detail.netIncome) }}万</b></div>
          </div>
          <div class="detail-extra">
            <span>效率 <b class="num">{{ fmtWan(detail.efficiency) }}万/h</b></span>
            <span>净效率 <b class="num">{{ fmtWan(detail.netEfficiency) }}万/h</b></span>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.records-page {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 0;
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
/* ---- 筛选栏 ---- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 14px;
  flex-wrap: wrap;
}
.preset :deep(.el-button) {
  margin-left: 0;
}
.range-picker {
  width: 250px;
}
.kw-input {
  width: 210px;
}
/* ---- 汇总 ---- */
.summary {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.summary b {
  color: var(--text-primary);
}
.summary .sep {
  margin: 0 6px;
}
.summary .net {
  font-size: 12.5px;
}
/* ---- 表格 ---- */
.lc-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
  --el-table-border-color: var(--line-separator);
  --el-table-header-text-color: var(--text-muted);
  --el-table-text-color: var(--text-primary);
  font-size: 13px;
}
.lc-table :deep(th.el-table__cell) {
  font-size: 12px;
  letter-spacing: 0.3px;
  font-weight: 500;
}
.date-cell {
  font-size: 13px;
  font-weight: 600;
}
.time-cell {
  font-size: 12px;
  color: var(--text-secondary);
}
.owner {
  font-size: 13px;
}
.owner-sub {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
}
.gold {
  color: var(--accent-500);
  font-weight: 600;
}
.neg {
  color: var(--negative);
  font-weight: 600;
}
.item-name {
  font-weight: 600;
}
.item-src {
  font-size: 12px;
  color: var(--text-muted);
}
/* ---- 分页 ---- */
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
/* ---- 清理记录 ---- */
.clear-entry {
  color: var(--text-secondary);
}
.clear-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.clear-lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.clear-scope {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-control);
  background: var(--surface-tray);
  box-shadow: var(--elev-inset-sm);
}
.clear-scope :deep(.el-radio) {
  display: flex;
  width: 100%;
  height: auto;
  margin-right: 0;
  align-items: flex-start;
  justify-content: flex-start;
}
.clear-scope :deep(.el-radio__input) {
  margin-top: 2px;
}
.clear-scope :deep(.el-radio__label) {
  line-height: 1.5;
  white-space: normal;
}
.scope-meta {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}
.clear-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.7;
}
/* ---- 详情弹窗 ---- */
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-separator);
}
.head-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.head-date {
  font-size: 15px;
  font-weight: 600;
}
.head-time {
  font-size: 12.5px;
  color: var(--text-secondary);
}
.head-owner {
  text-align: right;
}
.detail-table {
  margin-bottom: 14px;
}
.detail-totals {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.t-item {
  background: var(--surface-card);
  border: 0;
  border-radius: 12px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--elev-inset-sm);
}
.t-item span {
  font-size: 11px;
  color: var(--text-muted);
}
.t-item b {
  font-size: 13.5px;
}
.t-item.net {
  box-shadow: inset 2px 2px 5px var(--shade), inset -2px -2px 5px var(--glow),
    0 0 0 1.5px rgb(var(--accent-rgb) / 0.35);
}
.detail-extra {
  display: flex;
  gap: 18px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.detail-extra b {
  color: var(--text-primary);
}
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { activityApi, sourceApi } from '../api/basic'
import { formatLocalDate } from '../utils/date'
import type {
  ActivityOccurrenceDTO,
  ActivityRule,
  GameSourceDTO,
  SourceType
} from '@lc/shared'

/**
 * 活动维护与提醒。
 * 规则只有三种：每天 / 每周固定星期几 / 每月第 N 个星期几（第 5 个 = 当月最后一个）。
 */

const TYPE_LABEL: Record<SourceType, string> = {
  DUNGEON: '副本',
  GUILD: '帮派',
  ACTIVITY: '活动',
  DAILY: '日常',
  WEEKEND: '周末',
  CUSTOM: '自定义'
}
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
const WEEK_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const NTH_OPTIONS = [
  { value: 1, label: '第 1 个' },
  { value: 2, label: '第 2 个' },
  { value: 3, label: '第 3 个' },
  { value: 4, label: '第 4 个' },
  { value: 5, label: '最后一个' }
]

const sources = ref<GameSourceDTO[]>([])
const occurrences = ref<ActivityOccurrenceDTO[]>([])
const loading = ref(false)
const activeTab = ref<'timeline' | 'rules'>('timeline')
const filterType = ref('')

const weekStart = ref(formatLocalDate())
const weekDays = computed(() => {
  const start = parseDate(weekStart.value)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { date: formatLocalDate(d), label: `${d.getMonth() + 1}/${d.getDate()}`, week: WEEK_LABEL[d.getDay()] }
  })
})

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

async function loadSources() {
  const { data } = await sourceApi.list()
  sources.value = data.data
}

async function loadOccurrences() {
  loading.value = true
  try {
    const { data } = await activityApi.upcoming(weekStart.value, 7)
    occurrences.value = data.data
  } finally {
    loading.value = false
  }
}

function occOf(date: string): ActivityOccurrenceDTO[] {
  return occurrences.value.filter((o) => o.date === date)
}

function timeText(o: ActivityOccurrenceDTO): string {
  return `${o.start.slice(11, 16)}–${o.end.slice(11, 16)}${o.endsNextDay ? '（次日）' : ''}`
}

const filteredSources = computed(() =>
  filterType.value ? sources.value.filter((s) => s.type === filterType.value) : sources.value
)

function ruleText(rule: ActivityRule): string {
  const time = `${rule.start}–${rule.end}${rule.end <= rule.start ? '（次日）' : ''}`
  if (rule.type === 'DAILY') return `每天 ${time}`
  if (rule.type === 'WEEKLY') return `每${WEEK_LABEL[rule.dayOfWeek]} ${time}`
  const nth = rule.nth === 5 ? '最后一个' : `第 ${rule.nth} 个`
  return `每月${nth}${WEEK_LABEL[rule.dayOfWeek]} ${time}`
}

function reminderText(s: GameSourceDTO): string {
  if (!s.reminder.enabled) return '不提醒'
  return `提前 ${s.reminder.beforeMinutes} 分钟${s.reminder.atStart ? ' + 开始时' : ''}`
}

/* ---------------- 编辑 ---------------- */

const dialog = reactive({
  visible: false,
  id: 0,
  name: '',
  type: 'ACTIVITY' as SourceType,
  durationDesc: '',
  status: 'ENABLED',
  reminderEnabled: true,
  beforeMinutes: 10,
  atStart: true,
  rules: [] as ActivityRule[]
})

function blankRule(type: ActivityRule['type'] = 'DAILY'): ActivityRule {
  if (type === 'WEEKLY') return { type, dayOfWeek: 6, start: '10:00', end: '11:30' }
  if (type === 'MONTHLY_NTH') return { type, nth: 1, dayOfWeek: 0, start: '15:00', end: '17:00' }
  return { type: 'DAILY', start: '10:00', end: '11:30' }
}

function openCreate() {
  Object.assign(dialog, {
    visible: true,
    id: 0,
    name: '',
    type: 'ACTIVITY',
    durationDesc: '',
    status: 'ENABLED',
    reminderEnabled: true,
    beforeMinutes: 10,
    atStart: true,
    rules: [blankRule()]
  })
}

function openEdit(s: GameSourceDTO) {
  Object.assign(dialog, {
    visible: true,
    id: s.id,
    name: s.name,
    type: s.type,
    durationDesc: s.durationDesc ?? '',
    status: s.status,
    reminderEnabled: s.reminder.enabled,
    beforeMinutes: s.reminder.beforeMinutes,
    atStart: s.reminder.atStart,
    rules: s.rules.length ? JSON.parse(JSON.stringify(s.rules)) : [blankRule()]
  })
}

function addRule() {
  dialog.rules.push(blankRule())
}

function removeRule(i: number) {
  dialog.rules.splice(i, 1)
}

/** 切换规则类型时换成该类型的默认形状，避免残留字段 */
function changeRuleType(rule: ActivityRule, type: ActivityRule['type']) {
  const fresh = blankRule(type)
  fresh.start = rule.start
  fresh.end = rule.end
  Object.assign(rule, fresh)
}

async function save() {
  const name = dialog.name.trim()
  if (!name) return ElMessage.warning('活动名不能为空')
  if (!dialog.rules.length) return ElMessage.warning('至少配一条开始规则')
  for (const r of dialog.rules) {
    if (!r.start || !r.end) return ElMessage.warning('开始和结束时间都要填')
  }
  const body = {
    name,
    type: dialog.type,
    durationDesc: dialog.durationDesc.trim(),
    status: dialog.status,
    rules: dialog.rules,
    reminder: {
      enabled: dialog.reminderEnabled,
      beforeMinutes: Math.max(0, Math.round(dialog.beforeMinutes)),
      atStart: dialog.atStart
    }
  }
  try {
    if (dialog.id) await sourceApi.update(dialog.id, body)
    else await sourceApi.create(body)
    dialog.visible = false
    await Promise.all([loadSources(), loadOccurrences()])
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function removeSource(s: GameSourceDTO) {
  try {
    await ElMessageBox.confirm(`删除「${s.name}」？已有的历史记录不会受影响。`, '删除活动', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await sourceApi.remove(s.id)
    await Promise.all([loadSources(), loadOccurrences()])
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function shiftWeek(delta: number) {
  const d = parseDate(weekStart.value)
  d.setDate(d.getDate() + delta * 7)
  weekStart.value = formatLocalDate(d)
  void loadOccurrences()
}

onMounted(async () => {
  await Promise.all([loadSources(), loadOccurrences()])
})
</script>

<template>
  <div class="activities">
    <header class="page-head">
      <div>
        <h2>活动与提醒</h2>
        <p class="sub">
          内置规则仅为初始值，以游戏内公告为准。开始前会按下面的提醒设置弹通知。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增活动</el-button>
    </header>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="本周时间表" name="timeline">
        <div class="week-nav">
          <el-button @click="shiftWeek(-1)">上一周</el-button>
          <el-date-picker
            v-model="weekStart"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            style="width: 150px"
            @change="loadOccurrences"
          />
          <el-button @click="shiftWeek(1)">下一周</el-button>
          <span class="hint">从所选日期起 7 天</span>
        </div>

        <div v-loading="loading" class="timeline">
          <div v-for="d in weekDays" :key="d.date" class="day-col" :class="{ today: d.date === formatLocalDate() }">
            <div class="day-head">
              <span class="week">{{ d.week }}</span>
              <span class="date">{{ d.label }}</span>
            </div>
            <div class="day-body">
              <div v-for="o in occOf(d.date)" :key="`${o.sourceId}-${o.start}`" class="occ">
                <div class="occ-time">{{ timeText(o) }}</div>
                <div class="occ-name">{{ o.sourceName }}</div>
                <div class="occ-type">{{ TYPE_LABEL[o.sourceType] }}</div>
              </div>
              <div v-if="!occOf(d.date).length" class="empty">无安排</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="活动维护" name="rules">
        <div class="toolbar">
          <el-select v-model="filterType" clearable placeholder="全部类型" style="width: 140px">
            <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <span class="hint">共 {{ filteredSources.length }} 个活动</span>
        </div>

        <el-table :data="filteredSources" class="tbl">
          <el-table-column prop="name" label="活动名" min-width="140" />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">{{ TYPE_LABEL[row.type as SourceType] }}</template>
          </el-table-column>
          <el-table-column label="开始规则" min-width="260">
            <template #default="{ row }">
              <div v-for="(r, i) in row.rules" :key="i" class="rule-line">{{ ruleText(r) }}</div>
              <span v-if="!row.rules.length" class="hint">未配置</span>
            </template>
          </el-table-column>
          <el-table-column label="提醒" min-width="150">
            <template #default="{ row }">
              <el-tag :type="row.reminder.enabled ? 'success' : 'info'" size="small" effect="plain">
                {{ reminderText(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSource(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialog.visible" :title="dialog.id ? '编辑活动' : '新增活动'" width="620px">
      <el-form label-width="90px">
        <el-form-item label="活动名" required>
          <el-input v-model="dialog.name" maxlength="30" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="dialog.type" style="width: 180px">
            <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="时长说明">
          <el-input v-model="dialog.durationDesc" placeholder="例如 2 小时，可留空" maxlength="30" />
        </el-form-item>

        <el-form-item label="开始规则" required>
          <div class="rules">
            <div v-for="(r, i) in dialog.rules" :key="i" class="rule-row">
              <el-select
                :model-value="r.type"
                style="width: 110px"
                @update:model-value="(v: string) => changeRuleType(r, v as ActivityRule['type'])"
              >
                <el-option label="每天" value="DAILY" />
                <el-option label="每周" value="WEEKLY" />
                <el-option label="每月第 N 个" value="MONTHLY_NTH" />
              </el-select>

              <template v-if="r.type === 'MONTHLY_NTH'">
                <el-select v-model="r.nth" style="width: 100px">
                  <el-option v-for="n in NTH_OPTIONS" :key="n.value" :label="n.label" :value="n.value" />
                </el-select>
                <el-select v-model="r.dayOfWeek" style="width: 90px">
                  <el-option v-for="(w, idx) in WEEK_LABEL" :key="idx" :label="w" :value="idx" />
                </el-select>
              </template>

              <el-select v-else-if="r.type === 'WEEKLY'" v-model="r.dayOfWeek" style="width: 90px">
                <el-option v-for="(w, idx) in WEEK_LABEL" :key="idx" :label="w" :value="idx" />
              </el-select>

              <el-time-select v-model="r.start" start="00:00" step="00:05" end="23:55" placeholder="开始" style="width: 110px" />
              <span class="dash">–</span>
              <el-time-select v-model="r.end" start="00:00" step="00:05" end="23:55" placeholder="结束" style="width: 110px" />
              <el-button link type="danger" @click="removeRule(i)">删</el-button>
            </div>
            <el-button link type="primary" @click="addRule">+ 再加一条规则</el-button>
            <p class="hint">结束时间早于或等于开始时间时，按跨零点场次处理。</p>
          </div>
        </el-form-item>

        <el-form-item label="提醒">
          <el-switch v-model="dialog.reminderEnabled" />
          <template v-if="dialog.reminderEnabled">
            <span class="inline-label">提前</span>
            <el-input-number v-model="dialog.beforeMinutes" :min="0" :max="120" :precision="0" controls-position="right" style="width: 110px" />
            <span class="inline-label">分钟</span>
            <el-checkbox v-model="dialog.atStart" class="at-start">开始时再提醒一次</el-checkbox>
          </template>
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="dialog.status">
            <el-radio value="ENABLED">启用</el-radio>
            <el-radio value="DISABLED">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.activities {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.sub {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  max-width: 720px;
}
.week-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
}
.timeline {
  display: grid;
  grid-template-columns: repeat(7, minmax(120px, 1fr));
  gap: 10px;
  min-height: 300px;
}
.day-col {
  background: var(--surface-card);
  border: 0;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* 七列并排，凸起会让阴影互相污染，这里改成凹槽：整周是一块下沉的托盘 */
  box-shadow: var(--elev-inset-sm);
}
.day-col.today {
  box-shadow:
    inset 2px 2px 6px var(--shade),
    inset -2px -2px 6px var(--glow),
    0 0 0 2px rgb(var(--accent-rgb) / 0.35);
}
.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--surface-tray);
}
.week {
  font-weight: 600;
}
.date {
  color: var(--text-muted);
  font-size: 12px;
}
.day-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.occ {
  border-radius: 10px;
  padding: 8px 10px;
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
}
.occ-time {
  font-size: 12px;
  color: var(--accent-600);
  font-variant-numeric: tabular-nums;
}
.occ-name {
  font-weight: 600;
  font-size: 13px;
  margin-top: 2px;
}
.occ-type {
  font-size: 11px;
  color: var(--text-muted);
}
.empty {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.tbl {
  background: var(--bg-card);
  border-radius: var(--radius-card);
}
.rule-line {
  font-size: 13px;
  line-height: 1.7;
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.dash {
  color: var(--text-muted);
}
.inline-label {
  margin: 0 8px;
  color: var(--text-secondary);
}
.at-start {
  margin-left: 14px;
}
</style>

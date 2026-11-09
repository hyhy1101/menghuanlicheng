<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { onMounted, onBeforeUnmount, ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  GameItemDTO,
  GameSourceDTO,
  GameTeamDTO,
  GameRoleDTO,
  ItemPriceDTO,
  MileageSessionDTO
} from '@lc/shared'
import { basicApi, sessionApi, type DetailAddInput } from '../api/session'
import { itemApi, serverApi } from '../api/basic'
import { teamsApi } from '../api/dashboard'
import { useRecordStore } from '../stores/record'
import { fmtWan } from '../utils/format'
import { assetUrl } from '../utils/asset'
import CardHeader from '../components/CardHeader.vue'
import CostForm, { type CostPayload } from '../components/CostForm.vue'
import SummaryCard from '../components/SummaryCard.vue'

const router = useRouter()
const store = useRecordStore()

/**
 * 从托盘「今日活动」或系统通知点进来时，路由带上 sourceId。
 * 只做预选：没有会话时记在 pendingSource，开始计时后再写入会话；
 * 有会话时直接切换当前活动。绝不自动开始计时。
 */
const route = useRoute()
const pendingSource = ref<{ id: number; name: string } | null>(null)
const currentSource = computed(() => store.session?.currentSource ?? pendingSource.value)

const costDialogVisible = ref(false)
const quickItems = ref<GameItemDTO[]>([])
const FREQ_CAT = '__freq__' // 「常用」伪分类：近 1 月高频获得
const activeCat = ref(FREQ_CAT) // 默认选中「常用」；'' = 全部
const lastClick = ref<{ id: number; key: number } | null>(null)
const catTabs = [
  { code: FREQ_CAT, name: '⭐常用' },
  { code: '', name: '全部' },
  { code: 'EQUIP', name: '装备' },
  { code: 'BEAST_SKILL', name: '兽决' },
  { code: 'FIVE_TREASURE', name: '五宝' },
  { code: 'GEM', name: '宝石' },
  { code: 'OTHER', name: '其他' },
  { code: 'WEAPON', name: '武器' }
]
const teams = ref<GameTeamDTO[]>([])
const roles = ref<GameRoleDTO[]>([])
const target = ref<string>() // 'team:{id}' | 'role:{id}'
const elapsed = ref(0)
/**
 * 「新增号组」面板是否展开。
 * 已有号组在记时开始卡片平时是隐藏的（走 v-else 的记录主体），
 * 要并行开第二个号组，必须能主动把它叫出来。
 */
const showStart = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

/** 全部/具体分类点选：有等级按等级数值升序（无等级视为无穷大，排在最后），组内按中文名 */
const catalogShow = computed(() => {
  const list = activeCat.value ? quickItems.value.filter((i) => i.category === activeCat.value) : quickItems.value
  const lvl = (s: string) => {
    const n = Number.parseInt(s, 10)
    return Number.isNaN(n) ? Infinity : n
  }
  return [...list].sort((a, b) => lvl(a.level) - lvl(b.level) || a.name.localeCompare(b.name, 'zh'))
})

/** 「常用」：本人近 30 天已结束记录里按获得总数量降序的可点物品（服务端现算） */
const frequentItems = ref<GameItemDTO[]>([])
const isFreq = computed(() => activeCat.value === FREQ_CAT)
const quickGridItems = computed(() => (isFreq.value ? frequentItems.value : catalogShow.value))

async function loadFrequentItems() {
  try {
    const { data } = await basicApi.frequentItems()
    frequentItems.value = data.data
  } catch {
    frequentItems.value = []
  }
}

async function selectCat(code: string) {
  activeCat.value = code
  if (code === FREQ_CAT) await loadFrequentItems()
}

const formatElapsed = computed(() => {
  const s = elapsed.value
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
})

const fmt = fmtWan

function tick() {
  if (!store.session || store.paused) return
  elapsed.value = Math.floor((Date.now() - new Date(store.session.startTime.replace(' ', 'T')).getTime()) / 1000)
}

async function loadQuickItems() {
  try {
    const { data } = await basicApi.allItems()
    quickItems.value = data.data
  } catch {
    quickItems.value = []
  }
}

/** 收获已由右侧物品点选面板承担，弹窗只留给损耗 */
function openCostDialog() {
  costDialogVisible.value = true
}

/* ---- 当前活动 ---- */
const activityVisible = ref(false)
const activitySources = ref<GameSourceDTO[]>([])
const sourceTypeName: Record<string, string> = {
  DUNGEON: '副本', GUILD: '帮派', ACTIVITY: '活动', DAILY: '日常', WEEKEND: '周末', CUSTOM: '自定义'
}
const activityTypeFilter = ref('')
const activityKeyword = ref('')
const activitySearchRef = ref<{ focus: () => void } | null>(null)
const TYPE_ORDER = ['DUNGEON', 'GUILD', 'ACTIVITY', 'DAILY', 'WEEKEND', 'CUSTOM'] as const
const activityTypeOptions = computed(() => {
  const present = new Set(activitySources.value.map((s) => s.type))
  return TYPE_ORDER.filter((t) => present.has(t))
})
const filteredActivitySources = computed(() => {
  const kw = activityKeyword.value.trim().toLowerCase()
  return activitySources.value.filter(
    (s) =>
      (!activityTypeFilter.value || s.type === activityTypeFilter.value) &&
      (!kw || s.name.toLowerCase().includes(kw))
  )
})

async function openActivity() {
  activityTypeFilter.value = ''
  activityKeyword.value = ''
  try {
    const { data } = await basicApi.sources({ status: 'ENABLED' })
    activitySources.value = data.data
  } catch {
    activitySources.value = []
  }
  activityVisible.value = true
}

async function setActivity(sourceId: number | null) {
  if (!store.session) return
  try {
    const { data } = await sessionApi.setActivity(store.session.id, sourceId)
    store.applySession(data.data.session)
    activityVisible.value = false
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function loadStartOptions() {
  const [t, r] = await Promise.all([teamsApi.list(), teamsApi.roles()])
  teams.value = t.data.data
  roles.value = r.data.data
  if (!target.value) {
    if (teams.value.length) target.value = `team:${teams.value[0].id}`
    else if (roles.value.length) target.value = `role:${roles.value[0].id}`
  }
}

async function startSession() {
  if (!target.value) {
    ElMessage.warning('请选择号组或单开角色')
    return
  }
  const [kind, id] = target.value.split(':')
  const numId = Number(id)
  try {
    const { data } = await sessionApi.start({
      teamId: kind === 'team' ? numId : undefined,
      roleId: kind === 'role' ? numId : undefined
    })
    store.applySession(data.data.session)
    showStart.value = false
    // 从托盘/通知带进来的活动只在此刻落到会话上，不自动开始计时
    if (pendingSource.value) {
      await setActivity(pendingSource.value.id)
      pendingSource.value = null
    }
    ElMessage.success('已开始记录')
    tick()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function goTeams() {
  void router.push('/teams')
}

async function refreshSession() {
  // 接口现在返回的是全部进行中的会话（sessions 数组），交给 store 统一处理。
  // 不能再读 data.session —— 它是 undefined，会被 applySession 当成"结束当前会话"。
  await store.restore()
}

/** 损耗入账：不选物品、不归任何活动，一笔只有名称和总金额 */
async function onConfirmCost(payload: CostPayload) {
  if (!store.session) return
  const body: DetailAddInput = {
    itemName: payload.itemName,
    quantity: 1,
    unitPrice: payload.unitPrice,
    sourceId: null,
    direction: 'COST'
  }
  const { data } = await sessionApi.addDetail(store.session.id, body)
  store.applyTotals(data.data.totals)
  await refreshSession()
  costDialogVisible.value = false
}

/**
 * 九宫格格子里只放得下图标和数量，名称 / 单价 / 合计 / 来源活动改走悬浮提示。
 * 收获与损耗的信息项不同，所以分开拼。
 */
function detailTip(d: MileageSessionDTO['details'][number]) {
  if (d.direction === 'COST') {
    return `${d.itemName} · 损耗 -${fmt(Math.abs(d.itemValue))}万（点击改金额）`
  }
  const parts = [d.itemName ?? '', `单价 ${fmt(d.unitPrice)}万`, `合计 +${fmt(d.itemValue)}万`]
  if (d.source?.name) parts.push(d.source.name)
  return `${parts.join(' · ')}（点击改单价）`
}

/** 修改单条明细的价格：收获改单价，损耗改总金额（损耗数量恒为 1，改单价即改总额） */
async function onEditDetailPrice(d: MileageSessionDTO['details'][number]) {
  if (!store.session) return
  const isCost = d.direction === 'COST'
  try {
    const { value } = await ElMessageBox.prompt(
      isCost ? `「${d.itemName}」损耗金额（两）` : `「${d.itemName}」单价（两）`,
      isCost ? '修改损耗金额' : '修改单价',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: String(d.unitPrice),
        inputValidator: (v: string) => {
          const n = Number(v)
          if (!Number.isInteger(n) || n < 0) return '请输入非负整数（两）'
          return true
        }
      }
    )
    const n = Number(value)
    if (n === d.unitPrice) return
    const { data } = await sessionApi.updateDetail(store.session.id, d.id, { unitPrice: n })
    store.applyTotals(data.data.totals)
    await refreshSession()
  } catch {
    /* 取消 */
  }
}

/** 删除单条明细 */
async function onDeleteDetail(d: MileageSessionDTO['details'][number]) {
  if (!store.session) return
  // 损耗没有数量，不显示 ×N
  const desc = d.direction === 'COST' ? `损耗「${d.itemName}」` : `「${d.itemName}」×${d.quantity}`
  try {
    await ElMessageBox.confirm(`确定删除${desc}？`, '删除明细', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    const { data } = await sessionApi.deleteDetail(store.session.id, d.id)
    store.applyTotals(data.data.totals)
    await refreshSession()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function onImgError(e: Event) {
  const el = e.target as HTMLImageElement
  el.style.display = 'none'
}

/**
 * 点选物品图标添加 1 个收获。
 * - 固定价格物品：已维护用户录入价就静默入账；没维护过则弹三档价表单，
 *   填完保存到「物品 × 服务器」，再入账。
 * - 非固定价格物品：只问本次成交单价，不入价格表（价格浮动，写死没意义）。
 */
async function addOne(item: GameItemDTO) {
  if (!store.session) return
  lastClick.value = { id: item.id, key: Date.now() }

  if (item.isFixedPrice) {
    if (priceMap.value[item.id]?.userPrice) {
      await addDetail(item)
      return
    }
    openQuickPrice(item)
    return
  }

  let unitPrice: number
  try {
    const { value } = await ElMessageBox.prompt(
      `「${item.name}」本次成交单价（两）`,
      '本次单价',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValidator: (v: string) => {
          const n = Number(v)
          if (!Number.isInteger(n) || n <= 0) return '请输入正整数（两）'
          return true
        }
      }
    )
    unitPrice = Number(value)
  } catch {
    return // 取消就不记这一笔
  }
  await addDetail(item, unitPrice)
}

async function addDetail(item: GameItemDTO, unitPrice?: number) {
  if (!store.session) return
  try {
    await sessionApi.addDetail(store.session.id, {
      itemId: item.id,
      quantity: 1,
      direction: 'INCOME',
      sourceId: store.session.currentSource?.id,
      unitPrice
    })
    await refreshSession()
  } catch (e) {
    ElMessage.error((e as Error).message || '添加失败')
  }
}

/* ---- 固定价格物品的快速维护（记账时点未定价物品触发） ---- */

const priceMap = ref<Record<number, ItemPriceDTO>>({})

const quickPrice = reactive({
  visible: false,
  item: null as GameItemDTO | null,
  merchantPrice: 0,
  personalPrice: 0,
  userPrice: 0
})

async function loadPriceMap() {
  const serverId = store.session?.serverId
  if (!serverId) {
    priceMap.value = {}
    return
  }
  try {
    const { data } = await itemApi.pricesOfServer(serverId)
    priceMap.value = Object.fromEntries(data.data.map((p) => [p.itemId, p]))
  } catch {
    priceMap.value = {}
  }
}

function openQuickPrice(item: GameItemDTO) {
  const p = priceMap.value[item.id]
  Object.assign(quickPrice, {
    visible: true,
    item,
    merchantPrice: p?.merchantPrice ?? 0,
    personalPrice: p?.personalPrice ?? 0,
    userPrice: p?.userPrice ?? 0
  })
}

async function saveQuickPriceAndAdd() {
  const item = quickPrice.item
  const serverId = store.session?.serverId
  if (!item || !serverId) return
  if (!quickPrice.userPrice || quickPrice.userPrice <= 0) {
    ElMessage.warning('用户录入价必填，且要大于 0')
    return
  }
  try {
    const { data } = await itemApi.setPrice(item.id, serverId, {
      merchantPrice: quickPrice.merchantPrice || null,
      personalPrice: quickPrice.personalPrice || null,
      userPrice: Math.round(quickPrice.userPrice)
    })
    priceMap.value = { ...priceMap.value, [item.id]: data.data }
    quickPrice.visible = false
    ElMessage.success(`已保存「${item.name}」的价格`)
    await addDetail(item)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/** 物品图标下面那行小字：固定价格显示用户录入价，未维护提示「未定价」；浮动价显示「浮动」 */
function priceLabel(item: GameItemDTO): string {
  if (!item.isFixedPrice) return '浮动'
  const p = priceMap.value[item.id]
  return p?.userPrice ? `${fmt(p.userPrice)}万` : '未定价'
}

function goItems() {
  void router.push('/items')
}

// 换服务器（切到另一个并发会话）时重取该服价格
watch(() => store.session?.serverId, () => void loadPriceMap())

async function updateTotalSilver() {
  if (!store.session) return
  try {
    const { value } = await ElMessageBox.prompt('总银两（两）', '修改总银两', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: String(store.session.totalSilver),
      inputValidator: (v: string) => {
        const n = Number(v)
        if (!Number.isInteger(n) || n < 0) return '请输入非负整数'
        return true
      }
    })
    const { data } = await sessionApi.totalSilver(store.session.id, Number(value))
    store.session.totalSilver = Number(value)
    store.applyTotals(data.data.totals)
  } catch {
    /* 取消 */
  }
}


/**
 * 修改当前服务器的点卡单价。
 * 会话开始时已经快照了点卡价，所以改动只影响之后新建的记录；
 * 正在进行的这一场仍按开始时的价格算，避免中途数字跳变。
 */
async function updateCardPrice() {
  if (!store.session) return
  const serverId = store.session.serverId
  const label = store.session.serverName ?? `服务器#${serverId}`
  try {
    const { value } = await ElMessageBox.prompt(
      `「${label}」点卡单价（两/点）。已开始的记录仍按开始时的价格结算。`,
      '修改点卡价格',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: String(store.totals.cardPrice || 12800),
        inputValidator: (v: string) => {
          const n = Number(v)
          if (!Number.isInteger(n) || n < 1000 || n > 100000) return '请输入 1000~100000 的整数（两/点）'
          return true
        }
      }
    )
    await serverApi.update(serverId, { cardPrice: Number(value) })
    ElMessage.success('已保存，之后的记录按新价格计算')
  } catch (e) {
    if ((e as Error).message) ElMessage.error((e as Error).message)
  }
}

/* ---------- 忘点「结束」的里程找回（空档 ≥ 30 分钟判定） ---------- */
const STALE_IDLE_MIN = 30
const recoverVisible = ref(false)
const recoverSubmitting = ref(false)
const recoverEnd = ref('')

const pad2 = (n: number) => String(n).padStart(2, '0')
function fmtInputDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
const parseInputDateTime = (s: string) => new Date(s.replace(' ', 'T'))
function fmtGapMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

/** 当前 ACTIVE 会话距最近一次记账已过去多少分钟（null = 无会话） */
function sessionIdleMinutes(): number | null {
  const s = store.session
  if (!s) return null
  const base = s.lastActivityAt || s.startTime
  return Math.floor((Date.now() - parseInputDateTime(base).getTime()) / 60_000)
}

function openRecoverDialog() {
  const s = store.session
  if (!s || recoverVisible.value) return
  // 默认结束时间 = 最近一次记账 + 2 分钟，且夹在 [开始时间, 当前] 之间；宁少勿多，用户可上调
  const startMs = parseInputDateTime(s.startTime).getTime()
  const lastMs = parseInputDateTime(s.lastActivityAt || s.startTime).getTime()
  const endMs = Math.min(Date.now(), Math.max(startMs, lastMs + 2 * 60_000))
  recoverEnd.value = fmtInputDateTime(new Date(endMs))
  recoverVisible.value = true
}

const recoverGapText = computed(() => {
  const idle = sessionIdleMinutes()
  return idle !== null && idle >= 0 ? fmtGapMinutes(idle) : ''
})

/** 结束时间可选项：不能早于开始时间、不能晚于当前 */
function recoverDisabledDate(d: Date) {
  const s = store.session
  if (!s) return true
  return d.getTime() > Date.now() || d.getTime() < parseInputDateTime(s.startTime).getTime()
}

/** 结束并保存公共逻辑（普通结束 / 找回结束都走这里） */
async function finishSession(body: { endTime?: string } = {}) {
  const s = store.session
  if (!s) return
  const { data } = await sessionApi.end(s.id, body)
  store.setShare(data.data.shareText, data.data.summary)
  store.applySession(null)
  store.lastSummary = data.data.summary
}

/** 重新进入记录页：若上一场疑似忘结束，先弹找回而不是静默继续计时 */
function maybeRecoverAfterRestore() {
  const idle = sessionIdleMinutes()
  if (idle !== null && idle >= STALE_IDLE_MIN) openRecoverDialog()
}

async function confirmRecoverEnd() {
  const s = store.session
  if (!s || recoverSubmitting.value) return
  const end = recoverEnd.value.trim()
  if (!end) {
    ElMessage.warning('请先选择实际结束时间')
    return
  }
  const endMs = parseInputDateTime(end).getTime()
  const startMs = parseInputDateTime(s.startTime).getTime()
  if (Number.isNaN(endMs) || endMs < startMs) {
    ElMessage.warning('结束时间不能早于开始时间')
    return
  }
  if (endMs > Date.now() + 5 * 60_000) {
    ElMessage.warning('结束时间不能晚于当前时间')
    return
  }
  recoverSubmitting.value = true
  try {
    await finishSession({ endTime: end })
    recoverVisible.value = false
    ElMessage.success('已按所选时间结束并保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
    // 会话可能已被并发结束，重拉一次状态
    try {
      await refreshSession()
    } catch {
      /* ignore */
    }
  } finally {
    recoverSubmitting.value = false
  }
}

function keepRecording() {
  if (!recoverSubmitting.value) recoverVisible.value = false
}

async function discardRecover() {
  const s = store.session
  if (!s || recoverSubmitting.value) return
  try {
    await ElMessageBox.confirm('放弃本次记录将不会保存任何数据，确定放弃？', '放弃本次里程', {
      confirmButtonText: '放弃',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  recoverSubmitting.value = true
  try {
    await store.discard()
    recoverVisible.value = false
    ElMessage.success('已放弃本次记录')
  } finally {
    recoverSubmitting.value = false
  }
}

async function endRecord() {
  if (!store.session) return
  // 先拉最新会话（拿到刚更新的 lastActivityAt），再判断是否疑似“忘了结束”
  try {
    await refreshSession()
  } catch {
    /* 拉取失败则用本地 session 判定 */
  }
  const idle = sessionIdleMinutes()
  if (idle !== null && idle >= STALE_IDLE_MIN) {
    openRecoverDialog()
    return
  }
  try {
    await ElMessageBox.confirm('确定结束并保存本次里程？', '结束里程', {
      confirmButtonText: '结束并保存',
      cancelButtonText: '继续记录',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await finishSession()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function goBack() {
  void router.push('/')
}

onMounted(async () => {
  const qSourceId = Number(route.query.sourceId)
  const qSourceName = typeof route.query.sourceName === 'string' ? route.query.sourceName : ''
  if (Number.isInteger(qSourceId) && qSourceId > 0) {
    if (store.session) {
      await setActivity(qSourceId)
    } else {
      pendingSource.value = { id: qSourceId, name: qSourceName || `活动#${qSourceId}` }
    }
  }

  await store.restore()
  maybeRecoverAfterRestore() // 疑似“忘了结束/已离线”时先找回实际结束时间，避免多计点卡
  // restore 之后若已经有会话，刚记下的待选活动也直接落上去
  if (pendingSource.value && store.session) {
    const id = pendingSource.value.id
    pendingSource.value = null
    await setActivity(id)
  }
  await loadPriceMap()
  await loadQuickItems()
  if (isFreq.value) await loadFrequentItems()
  if (!store.session) await loadStartOptions()
  tick()
  timer = setInterval(tick, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="record-page">
    <header class="header">
      <el-button class="btn-ghost" @click="goBack">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        返回
      </el-button>
      <span class="ctx">
        <template v-if="store.session">
          <span class="ctx-tag">{{ store.session.teamName || store.session.roleName || '单开' }}</span>
          <span class="ctx-sep">·</span>
          <span v-if="store.session.serverName">{{ store.session.serverName }}</span>
          <span v-else>服务器 #{{ store.session.serverId || '-' }}</span>
        </template>
        <span v-else class="ctx-standby">尚未开始 · 选择号组或单开角色后开始</span>
      </span>
      <template v-if="store.session">
        <div class="timer-box" :class="{ paused: store.paused }">
          <span class="timer-dot" />
          <span class="timer-state">{{ store.paused ? '已暂停' : '记录中' }}</span>
          <span class="timer-value num">{{ formatElapsed }}</span>
        </div>
        <button class="btn-activity" :class="{ on: !!currentSource }" @click="openActivity">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
          <span>{{ currentSource?.name ?? '选活动' }}</span>
        </button>
        <el-button class="btn-ghost" @click="showStart = true">
          ＋ 号组
        </el-button>
        <el-button class="btn-ghost" @click="store.setPaused(!store.paused)">
          {{ store.paused ? '▶ 恢复' : '⏸ 暂停' }}
        </el-button>
        <el-button type="primary" class="btn-end" @click="endRecord">
          结束并保存里程
        </el-button>
      </template>
    </header>

    <!--
      并发记账：多个号组同时进行时的切换标签。
      只有一条时不显示 —— 单个标签是噪音，而且头部已经写明了是哪个号组。
    -->
    <nav v-if="store.activeCount > 1" class="group-tabs" aria-label="进行中的号组">
      <button
        v-for="s in store.sessions"
        :key="s.id"
        type="button"
        class="group-tab"
        :class="{ on: s.id === store.currentId }"
        @click="store.select(s.id)"
      >
        <span class="gt-name">{{ s.teamName || s.roleName || '单开' }}</span>
        <span class="gt-net num" :class="s.netIncome >= 0 ? 'up' : 'down'">{{ fmt(s.netIncome) }}万</span>
      </button>
    </nav>

    <div v-if="showStart || !store.session" class="start-wrap">
      <div class="start-card">
        <div class="start-head">
          <div class="start-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" />
              <path d="M12 2v20M21 7l-9 5M3 7l9 5" />
            </svg>
          </div>
          <div>
            <div class="start-title">开始今日里程</div>
            <div class="start-sub">选择号组或单开角色后开始计时，结束自动结算</div>
          </div>
        </div>

        <div class="start-fields">
          <label class="field">
            <span class="field-label">号组 / 单开</span>
            <el-select v-model="target" placeholder="选择号组或角色" class="field-select">
              <el-option-group v-if="teams.length" label="号组">
                <el-option
                  v-for="t in teams"
                  :key="'team:' + t.id"
                  :value="'team:' + t.id"
                  :label="`${[t.name, t.serverName].filter(Boolean).join(' · ')}（${t.roleCount} 角色）`"
                />
              </el-option-group>
              <el-option-group v-if="roles.length" label="单开">
                <el-option
                  v-for="r in roles"
                  :key="'role:' + r.id"
                  :value="'role:' + r.id"
                  :label="[r.name, r.teamName, r.serverName].filter(Boolean).join(' · ')"
                />
              </el-option-group>
            </el-select>
          </label>
        </div>

        <div v-if="pendingSource" class="start-pending">
          <span class="sp-icon">◎</span>
          <span class="sp-text">开始后第一笔收获归到「{{ pendingSource.name }}」</span>
          <el-button link type="primary" @click="pendingSource = null">取消预选</el-button>
        </div>

        <div v-if="!teams.length && !roles.length" class="start-empty">
          还没有号组或角色，请先
          <el-button link type="primary" @click="goTeams">前往「角色 / 号组」创建</el-button>
        </div>

        <!-- 已有号组在记时，这里说明是"再开一个"，并给出退回当前记录的出口 -->
        <div v-if="store.session" class="start-hint">
          <span>已有 {{ store.activeCount }} 个号组在记录，选其他号组可并行开始。</span>
          <el-button link type="primary" @click="showStart = false">返回当前记录</el-button>
        </div>

        <el-button type="primary" class="btn-start" :disabled="!target" @click="startSession">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          开始记录
        </el-button>
      </div>
    </div>

    <template v-else>
    <div class="body">
      <div class="left">
        <div class="card summary-card">
          <div class="summary-top">
            <div class="net-label">净收益</div>
            <div class="net-value num" :class="store.totals.netIncome >= 0 ? 'up' : 'down'">
              {{ fmt(store.totals.netIncome) }}<span class="unit">万</span>
            </div>
          </div>
          <div class="divider" />
          <div class="stat-grid">
            <div class="stat-row"><span>物品收益合计</span><span class="num">{{ fmt(store.totals.itemSum) }}万</span></div>
            <div class="stat-row clickable" @click="updateTotalSilver">
              <span>总银两 <span class="hint">(点击修改)</span></span>
              <span class="num">{{ fmt(store.totals.totalSilver) }}万</span>
            </div>
            <div class="stat-row cost clickable" title="点击录入今日点卡价格" @click="updateCardPrice">
              <span>点卡成本 <span class="hint">{{ store.totals.cardPrice }}两/点 · 点击录入</span></span>
              <span class="num">-{{ fmt(store.totals.cardCost) }}万</span>
            </div>
            <div class="stat-row cost clickable" title="点击录入损耗" @click="openCostDialog">
              <span>损耗合计 <span class="hint">点击录入</span></span>
              <span class="num">-{{ fmt(store.totals.lossTotal) }}万</span>
            </div>
            <div class="stat-row income"><span>总收益</span><span class="num">{{ fmt(store.totals.totalIncome) }}万</span></div>
            <div class="stat-row"><span>效率</span><span class="num">{{ fmt(store.totals.netEfficiency) }}万/h</span></div>
          </div>
        </div>

        <div class="card grow">
          <CardHeader icon="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z">
            <template #title>本次收获</template>
            <template #extra><span class="hint">点右侧物品图标添加</span></template>
          </CardHeader>
          <div class="gain-list">
            <div v-if="!store.session?.details.length" class="gain-empty">
              还没有记录，点右侧物品图标添加
            </div>
            <div
              v-for="d in store.session?.details"
              :key="d.id"
              class="gain-row"
              :class="{ cost: d.direction === 'COST' }"
              :title="detailTip(d)"
              @click="onEditDetailPrice(d)"
            >
              <span class="g-icon">
                <i>{{ (d.itemName ?? '?')[0] }}</i>
                <img v-if="d.iconUrl" :src="assetUrl(d.iconUrl) ?? ''" :alt="d.itemName ?? ''" loading="lazy" @error="onImgError" />
              </span>
              <span class="g-main">
                <span class="g-name">{{ d.itemName ?? '未知物品' }}</span>
                <span class="g-sub">
                  {{ d.direction === 'COST' ? '损耗' : `单价 ${fmt(d.unitPrice)}万` }}
                  <template v-if="d.source?.name"> · {{ d.source.name }}</template>
                </span>
              </span>
              <!-- 损耗恒为 1 件，没有数量概念 -->
              <span v-if="d.direction !== 'COST'" class="g-qty num">×{{ d.quantity }}</span>
              <span class="g-sum num" :class="d.direction === 'COST' ? 'down' : 'up'">
                {{ d.direction === 'COST' ? '-' : '+' }}{{ fmt(Math.abs(d.itemValue)) }}万
              </span>
              <button class="g-del" title="删除" @click.stop="onDeleteDetail(d)">×</button>
            </div>
          </div>
        </div>

      </div>

      <div class="right">
        <div class="card">
          <CardHeader icon="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z">
            <template #title>物品点选</template>
            <template #extra>
              <el-button link type="primary" @click="goItems">物品信息</el-button>
            </template>
          </CardHeader>
          <div class="cat-tabs">
            <button
              v-for="c in catTabs"
              :key="c.code || '__all__'"
              class="cat-tab"
              :class="{ on: activeCat === c.code }"
              @click="selectCat(c.code)"
            >
              {{ c.name }}
            </button>
          </div>
          <div class="quick-grid">
            <div
              v-for="item in quickGridItems"
              :key="item.id + (lastClick && lastClick.id === item.id ? ':' + lastClick.key : '')"
              class="grid-item"
              :class="{ pop: lastClick && lastClick.id === item.id }"
              :title="item.name"
              @click="addOne(item)"
            >
              <span class="grid-icon">
                <img v-if="item.iconUrl" :src="assetUrl(item.iconUrl) ?? ''" :alt="item.name" loading="lazy" @error="onImgError" />
              </span>
              <span class="grid-name">{{ item.name }}</span>
              <span class="grid-meta">{{ priceLabel(item) }}<i v-if="item.level"> · {{ item.level }}</i></span>
            </div>
            <div v-if="!quickGridItems.length" class="hint empty">{{ isFreq ? '近 30 天还没有获得记录，去其他分类点选' : '该分类暂无物品' }}</div>
          </div>
          <p class="hint pick-hint">
            固定价格物品按维护好的用户录入价入账；第一次点会先让你填三档价。非固定价格物品每次录入本次成交单价。
          </p>
        </div>
      </div>

    </div>

    </template>

    <el-dialog v-model="costDialogVisible" :width="460" align-center>
      <CostForm @confirm="onConfirmCost" />
    </el-dialog>

    <el-dialog v-model="quickPrice.visible" :title="`维护「${quickPrice.item?.name ?? ''}」的价格`" width="440px" align-center>
      <p class="qp-hint">这个物品在当前服务器还没有用户录入价，先填一次，之后点选就直接按它入账。</p>
      <el-form label-width="120px">
        <el-form-item label="商人收购价">
          <el-input-number v-model="quickPrice.merchantPrice" :min="0" :step="1000" :precision="0" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="个人收购价">
          <el-input-number v-model="quickPrice.personalPrice" :min="0" :step="1000" :precision="0" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用户录入价" required>
          <el-input-number v-model="quickPrice.userPrice" :min="1" :step="1000" :precision="0" :controls="false" style="width: 100%" />
        </el-form-item>
      </el-form>
      <p class="qp-note">单位：两。记账用的是用户录入价，前两档只做参考，可以不填。</p>
      <template #footer>
        <el-button @click="quickPrice.visible = false">取消</el-button>
        <el-button type="primary" @click="saveQuickPriceAndAdd">保存并添加</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="activityVisible"
      title="选择当前活动"
      :width="520"
      align-center
      @opened="activitySearchRef?.focus()"
    >
      <el-input
        ref="activitySearchRef"
        v-model="activityKeyword"
        class="activity-search"
        placeholder="输入活动名称过滤"
        clearable
      />
      <div class="activity-filter">
        <button
          class="af-chip"
          :class="{ on: activityTypeFilter === '' }"
          @click="activityTypeFilter = ''"
        >全部</button>
        <button
          v-for="t in activityTypeOptions"
          :key="t"
          class="af-chip"
          :class="{ on: activityTypeFilter === t }"
          @click="activityTypeFilter = activityTypeFilter === t ? '' : t"
        >{{ sourceTypeName[t] }}</button>
      </div>
      <div class="activity-list">
        <button
          class="activity-row"
          :class="{ on: !store.session?.currentSource }"
          @click="setActivity(null)"
        >
          <span class="a-badge none">—</span>
          <span class="a-name">不归活动</span>
          <span class="a-desc">此后添加的收获不归属任何玩法</span>
        </button>
        <button
          v-for="s in filteredActivitySources"
          :key="s.id"
          class="activity-row"
          :class="{ on: store.session?.currentSource?.id === s.id }"
          @click="setActivity(s.id)"
        >
          <span class="a-badge" :class="s.type.toLowerCase()">{{ sourceTypeName[s.type] ?? s.type }}</span>
          <span class="a-name">{{ s.name }}</span>
          <span class="a-desc">{{ s.durationDesc || s.intro || '' }}</span>
        </button>
        <div v-if="!filteredActivitySources.length" class="activity-empty">没有匹配的活动</div>
      </div>
      <template #footer>
        <el-button @click="activityVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recoverVisible" title="上一场里程疑似未结束" :width="460" align-center :close-on-click-modal="false" :show-close="false">
      <div v-if="store.session" class="recover-body">
        <p>该场记录开始于 <b class="num">{{ store.session.startTime }}</b>，距你最近一次记账已约 <b class="warn">{{ recoverGapText }}</b>。</p>
        <p>如果直接「现在结束」，这段空档会被一并计入点卡消耗。请把结束时间改为你实际下号 / 停止游戏的时间。</p>
        <div class="recover-field">
          <span class="recover-label">实际结束时间</span>
          <el-date-picker
            v-model="recoverEnd"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            :clearable="false"
            :editable="false"
            :disabled-date="recoverDisabledDate"
            placeholder="选择实际结束时间"
            style="width: 100%"
          />
        </div>
      </div>
      <template #footer>
        <el-button type="danger" link :disabled="recoverSubmitting" @click="discardRecover">放弃本次记录</el-button>
        <span class="spacer" />
        <el-button :disabled="recoverSubmitting" @click="keepRecording">还在玩，继续记录</el-button>
        <el-button type="primary" :loading="recoverSubmitting" @click="confirmRecoverEnd">按此时间结束并保存</el-button>
      </template>
    </el-dialog>

    <SummaryCard />
  </div>
</template>

<style scoped>
.record-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}
/* ---- 顶部状态条 ---- */
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-panel) 85%, transparent), color-mix(in srgb, var(--bg-panel) 55%, transparent));
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(6px);
}
.ctx {
  color: var(--text-secondary);
  flex: 1;
  /* 页头右侧多了「结束并保存」后，必须允许这栏被压缩，
     否则窄屏下 ctx 撑住宽度会把暂停/结束按钮挤出视口 */
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.ctx-tag {
  color: var(--ink-accent);
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid rgb(var(--accent-rgb) / 0.3);
  background: rgb(var(--accent-rgb) / 0.08);
}
.ctx-sep {
  color: var(--text-muted);
}
.timer-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border-radius: 20px;
  border: 1px solid rgb(var(--positive-rgb) / 0.36);
  background: rgb(var(--positive-rgb) / 0.1);
  color: var(--positive);
}
.timer-box.paused {
  border-color: rgb(var(--warning-rgb) / 0.4);
  background: rgb(var(--warning-rgb) / 0.12);
  color: var(--warning);
}
.timer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: breathe 1.6s infinite;
  box-shadow: 0 0 8px currentColor;
}
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.timer-state {
  font-size: 13px;
}
.timer-value {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
  min-width: 96px;
  text-align: center;
}
/* ---- 主体 ---- */
.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 18px 24px;
  overflow: hidden;
}
.card {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: var(--card-shadow);
}
.left {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 左右两栏各占一半，卡片统一撑满一栏高度，内部再各自滚动 */
.left .card,
.right .card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
/* 左栏：汇总卡按内容高度，收获列表吃掉剩余空间 */
.left .card.grow,
.right .card {
  flex: 1;
}
/* 标题行、分类标签都按内容高度，不参与拉伸（否则会被撑到半张卡片高） */
.left .card :deep(.card-title),
.right .card :deep(.card-title),
.left .card > .cat-tabs,
.right .card > .cat-tabs {
  flex: 0 0 auto;
}
.right {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}
/* ---- 本次收获：一行一件，左图标 + 名称/单价 + 数量 + 小计 ---- */
.gain-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding-right: 4px;
}
.gain-empty {
  padding: 26px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
.gain-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s;
}
.gain-row:hover {
  background: var(--bg-raised);
  border-color: rgb(var(--accent-rgb) / 0.35);
}
.gain-row.cost:hover {
  border-color: rgb(var(--negative-rgb) / 0.45);
}
.g-icon {
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 9px;
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.2), rgb(var(--accent-rgb) / 0.05));
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-accent);
  overflow: hidden;
}
.gain-row.cost .g-icon {
  background: linear-gradient(135deg, rgb(var(--negative-rgb) / 0.2), rgb(var(--negative-rgb) / 0.06));
  border-color: rgb(var(--negative-rgb) / 0.36);
  color: var(--negative);
}
.g-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.g-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-icon i {
  font-style: normal;
}
.g-icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}
/* 数量与小计：等宽数字，右对齐成一列 */
.g-qty {
  flex-shrink: 0;
  min-width: 34px;
  text-align: right;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.g-sum {
  flex-shrink: 0;
  min-width: 78px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
}
.g-sum.up {
  color: var(--ink-accent);
}
.g-sum.down {
  color: var(--negative);
}
/* 删除：常驻显示——触屏没有 hover，藏起来就点不到 */
.g-del {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--bg-raised);
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.g-del:hover {
  background: var(--negative);
  color: #fff;
}
/* ---- 物品点选 ---- */
.cat-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.cat-tab {
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.cat-tab:hover {
  border-color: rgb(var(--accent-rgb) / 0.4);
  color: var(--ink-accent);
}
.cat-tab.on {
  background: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  border-color: transparent;
  color: var(--on-accent);
  font-weight: 600;
}
.quick-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  /* 固定列宽 + 左对齐：物品少时不会把几个图标摊满整行，多时按行排下去 */
  grid-template-columns: repeat(auto-fill, 82px);
  justify-content: start;
  align-content: start;
  gap: 10px;
  overflow-y: auto;
  padding: 4px;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 6px 2px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.13s, border-color 0.13s, transform 0.13s;
}
.grid-item:hover {
  background: var(--bg-raised);
  border-color: rgb(var(--accent-rgb) / 0.35);
  transform: translateY(-1px);
}
.grid-icon {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.2), rgb(var(--accent-rgb) / 0.05));
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-accent);
  overflow: hidden;
}
.grid-icon i {
  font-style: normal;
}
.grid-icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}
.grid-name {
  font-size: 11px;
  color: var(--text-secondary);
  width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grid-meta {
  font-size: 10px;
  color: var(--text-muted);
  width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grid-meta i {
  font-style: normal;
}
.empty {
  grid-column: 1 / -1;
  padding: 20px 0;
  text-align: center;
}
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
.pop {
  animation: pop 0.32s ease;
}
/* ---- 右栏提示 ---- */
.pick-hint {
  flex-shrink: 0;
  margin: 10px 4px 0;
  line-height: 1.6;
}
.qp-hint,
.qp-note {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.qp-note {
  margin: 8px 0 0;
}
/* ---- 实时汇总 ---- */
.summary-card {
  flex-shrink: 0;
  overflow: hidden;
}
.summary-card::before {
  content: '';
  display: block;
  height: 3px;
  margin: -18px -18px 14px;
  background: linear-gradient(90deg, var(--accent-500), rgb(var(--accent-rgb) / 0.15), transparent);
}
.summary-top {
  margin-bottom: 4px;
}
.net-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
.net-value {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 1.2;
}
.net-value .unit {
  font-size: 16px;
  font-weight: 600;
  margin-left: 3px;
}
.net-value.up {
  color: var(--accent-500);
  text-shadow: 0 0 22px rgb(var(--accent-rgb) / 0.35);
}
.net-value.down {
  color: var(--negative);
}
.divider {
  border-top: 1px solid var(--border);
  margin: 10px 0;
}
/* 汇总卡占满半屏宽，统计项分两列铺开，避免右侧留白 */
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 28px;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  color: var(--text-secondary);
  font-size: 13.5px;
}
.stat-row.clickable {
  cursor: pointer;
}
.stat-row.clickable:hover {
  color: var(--ink-accent);
}
.stat-row.cost span:last-child {
  color: var(--negative);
}
.stat-row.income span:last-child {
  color: var(--accent-500);
  font-weight: 600;
}
.spacer {
  flex: 1;
}
.btn-ghost {
  margin: 0;
  height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-control);
  border: 0;
  background: var(--surface-card);
  color: var(--text-secondary);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--elev-raised-xs);
  transition: box-shadow var(--dur-3) var(--ease-out), color var(--dur-2) ease;
}
.btn-ghost:hover {
  color: var(--text-primary);
  box-shadow: var(--elev-hover);
}
.btn-ghost:active {
  box-shadow: var(--elev-pressed);
}
/* 结束并保存：现在是页头主操作，尺寸对齐同排的 .btn-ghost */
.btn-end {
  margin: 0;
  height: 42px;
  padding: 0 22px;
  border-radius: var(--radius-control);
  border: none;
  font-weight: 600;
  background: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  color: var(--on-accent);
  box-shadow: 0 4px 18px rgb(var(--accent-rgb) / 0.4);
}
.btn-end:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgb(var(--accent-rgb) / 0.5);
  background: var(--btn-accent-bg);
  color: var(--on-accent);
}
/* ---- 开始卡片（无进行中会话时） ---- */
.start-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}
.start-card {
  width: 460px;
  max-width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 30px 30px 26px;
  box-shadow: var(--card-shadow);
}
.start-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.start-badge {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-500);
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.22), rgb(var(--accent-rgb) / 0.05));
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  box-shadow: 0 0 18px rgb(var(--accent-rgb) / 0.18);
}
.start-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.start-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}
.start-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 22px 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.field-select {
  width: 100%;
}
.start-pending {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgb(var(--accent-rgb) / 0.08);
  border: 1px solid rgb(var(--accent-rgb) / 0.22);
  font-size: 13px;
  color: var(--text-secondary);
}
.sp-icon {
  color: var(--accent-500);
}
.sp-text {
  flex: 1;
}
.start-empty {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--bg-raised);
  border: 1px dashed var(--border-strong);
  margin-bottom: 16px;
}
.btn-start {
  width: 100%;
  height: 46px;
  margin: 0;
  border: none;
  border-radius: var(--radius-control);
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  color: var(--on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 18px rgb(var(--accent-rgb) / 0.35);
}
.btn-start:hover:not(.is-disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgb(var(--accent-rgb) / 0.45);
  background: var(--btn-accent-bg);
  color: var(--on-accent);
}
.btn-start.is-disabled {
  background: var(--bg-raised);
  color: var(--text-muted);
  box-shadow: none;
}
.ctx-standby {
  color: var(--text-muted);
}
/* ---- 当前活动 ---- */
.btn-activity {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 20px;
  border: 1px dashed rgb(var(--accent-rgb) / 0.4);
  background: rgb(var(--accent-rgb) / 0.06);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-activity:hover {
  border-color: rgb(var(--accent-rgb) / 0.65);
  color: var(--ink-accent);
  background: rgb(var(--accent-rgb) / 0.12);
}
.btn-activity.on {
  border-style: solid;
  border-color: rgb(var(--accent-rgb) / 0.55);
  background: rgb(var(--accent-rgb) / 0.14);
  color: var(--ink-accent);
}
.activity-search {
  margin-bottom: 10px;
}
.activity-search :deep(.el-input__wrapper) {
  height: 38px;
  border-radius: var(--radius-control);
}
.activity-empty {
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
.activity-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.af-chip {
  padding: 4px 12px;
  border-radius: 999px;
  border: 0;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: var(--elev-raised-xs);
  transition: box-shadow var(--dur-3) var(--ease-out), color var(--dur-2) ease;
}
.af-chip:hover {
  color: var(--accent-600);
  box-shadow: var(--elev-hover);
}
.af-chip.on {
  color: var(--accent-600);
  box-shadow: var(--elev-pressed);
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}
.activity-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 0;
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--elev-raised-xs);
  transition: box-shadow var(--dur-3) var(--ease-out);
  font-family: inherit;
}
.activity-row:hover {
  box-shadow: var(--elev-hover);
}
.activity-row.on {
  box-shadow: var(--elev-pressed);
}
.a-badge {
  flex-shrink: 0;
  min-width: 44px;
  text-align: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-600);
  border: 0;
  background: rgb(var(--accent-rgb) / 0.12);
}
.a-badge.none {
  color: var(--text-muted);
  background: rgb(61 68 81 / 0.06);
}
.a-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}
.a-desc {
  color: var(--text-muted);
  font-size: 12px;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 忘点「结束」里程的找回弹窗 */
.recover-body p {
  margin: 0 0 10px;
  line-height: 1.65;
  font-size: 14px;
  color: var(--text-secondary);
}
.recover-body .warn {
  color: var(--warning);
}
.recover-field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.recover-label {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-muted);
}

/* ===== 并发号组切换标签（多个号组同时记账时出现） ===== */
.group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  overflow-x: auto;
}
.group-tab {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
.group-tab:hover {
  border-color: var(--accent-500);
  color: var(--text-primary);
}
.group-tab.on {
  background: var(--accent-500);
  border-color: var(--accent-500);
  color: var(--on-accent);
  font-weight: 600;
}
/* 选中时整枚标签走主色底，净收益跟着换成前景色，避免深绿压深绿看不清 */
.group-tab.on .gt-net {
  color: var(--on-accent);
  opacity: 0.86;
}
.gt-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gt-net.up {
  color: var(--positive);
}
.gt-net.down {
  color: var(--negative);
}

/* 「再开一个号组」时的说明行 */
.start-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-raised);
  color: var(--text-secondary);
  font-size: 13px;
}
</style>

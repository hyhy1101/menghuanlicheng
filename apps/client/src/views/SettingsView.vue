<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { profileApi, serverApi, settingsApi } from '../api/basic'
import { teamsApi } from '../api/dashboard'
import { useAppStore } from '../stores/app'
import { assetUrl } from '../utils/asset'
import type { GameServerDTO, GameTeamDTO } from '@lc/shared'

const app = useAppStore()

const servers = ref<GameServerDTO[]>([])
const teams = ref<GameTeamDTO[]>([])

const profile = reactive({ nickname: '玩家', avatar: null as string | null })
const autoLaunch = ref(false)
const saving = ref(false)

const serverDialog = reactive({
  visible: false,
  id: 0,
  name: '',
  cardPrice: 12800
})

/** 倒计时秒数：给手滑和「先导出备份」留出反应时间 */
const CONFIRM_SECONDS = 10
/** 必须原样输入的字，挡掉一路回车清库 */
const CONFIRM_TEXT = '我确认'

const initDialog = reactive({ visible: false, input: '' })
const countdown = ref(CONFIRM_SECONDS)
const initializing = ref(false)
const canConfirm = computed(
  () => countdown.value === 0 && initDialog.input.trim() === CONFIRM_TEXT && !initializing.value
)
let countdownTimer: number | undefined

function stopCountdown() {
  if (countdownTimer !== undefined) {
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
  }
}

async function loadAll() {
  await app.ensureSettings()
  const [s, t] = await Promise.all([serverApi.list(), teamsApi.list()])
  servers.value = s.data.data.list
  teams.value = t.data.data
}

async function loadProfile() {
  try {
    // 走 store：顶栏也跟着刷新
    const p = await app.loadProfile(true)
    if (!p) return
    profile.nickname = p.nickname
    profile.avatar = assetUrl(p.avatar)
  } catch {
    /* 忽略 */
  }
}

async function saveProfile() {
  const nickname = profile.nickname.trim()
  if (!nickname) return ElMessage.warning('昵称不能为空')
  try {
    const { data } = await profileApi.update({ nickname })
    app.setProfile(data.data)
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

const avatarInput = ref<HTMLInputElement | null>(null)

async function onAvatarPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 2 * 1024 * 1024) return ElMessage.warning('图片不能超过 2MB')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  try {
    await profileApi.uploadAvatar(dataUrl)
    await loadProfile()
    ElMessage.success('头像已更新')
  } catch (err) {
    ElMessage.error((err as Error).message)
  }
}

/* ---------------- 服务器 ---------------- */

function openServer(row?: GameServerDTO) {
  Object.assign(serverDialog, {
    visible: true,
    id: row?.id ?? 0,
    name: row?.name ?? '',
    cardPrice: row?.cardPrice ?? 12800
  })
}

async function saveServer() {
  const name = serverDialog.name.trim()
  if (!name) return ElMessage.warning('服务器名不能为空')
  if (!serverDialog.cardPrice || serverDialog.cardPrice <= 0) {
    return ElMessage.warning('点卡单价要大于 0')
  }
  saving.value = true
  try {
    if (serverDialog.id) {
      await serverApi.update(serverDialog.id, {
        name,
        cardPrice: Math.round(serverDialog.cardPrice)
      })
    } else {
      await serverApi.create({ name, cardPrice: Math.round(serverDialog.cardPrice) })
    }
    serverDialog.visible = false
    await loadAll()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

async function removeServer(row: GameServerDTO) {
  try {
    await ElMessageBox.confirm(`删除服务器「${row.name}」？`, '删除服务器', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await serverApi.remove(row.id)
    await loadAll()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/* ---------------- 偏好 ---------------- */

async function patch(p: Record<string, unknown>) {
  try {
    await app.saveSettings(p)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/* ---------------- 一键初始化 ---------------- */

function openInit() {
  stopCountdown()
  initDialog.input = ''
  countdown.value = CONFIRM_SECONDS
  initDialog.visible = true
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) stopCountdown()
  }, 1000)
}

function closeInit() {
  stopCountdown()
  initDialog.visible = false
}

async function doInit() {
  if (!canConfirm.value) return
  initializing.value = true
  try {
    const { data } = await settingsApi.resetData()
    const r = data.data
    closeInit()
    await loadAll()
    await loadProfile()
    const { data: next } = await settingsApi.get()
    app.setSettings(next.data)
    const cleared = r.servers + r.teams + r.roles + r.records + r.itemPrices
    ElMessage.success(
      cleared > 0
        ? `已清空：${r.servers} 个服务器、${r.teams} 个号组、${r.roles} 个角色、${r.records} 条记录`
        : '本地本来就没有数据，已复位昵称与默认设置'
    )
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    initializing.value = false
  }
}

async function toggleAutoLaunch(v: boolean) {
  try {
    await window.lc.setAutoLaunch(v)
    autoLaunch.value = v
  } catch (e) {
    autoLaunch.value = !v
    ElMessage.error((e as Error).message)
  }
}

onBeforeUnmount(stopCountdown)

onMounted(async () => {
  await Promise.all([loadAll(), loadProfile()])
  try {
    autoLaunch.value = await window.lc.getAutoLaunch()
  } catch {
    /* 忽略 */
  }
})
</script>

<template>
  <div class="settings">
    <header class="page-head">
      <h2>设置</h2>
      <p class="sub">这些设置只保存在本机。</p>
    </header>

    <section class="card">
      <h3>本地档案</h3>
      <div class="avatar-row">
        <el-avatar :size="56" :src="profile.avatar ?? undefined">{{ profile.nickname.slice(0, 1) }}</el-avatar>
        <el-button size="small" @click="avatarInput?.click()">更换头像</el-button>
        <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onAvatarPicked" />
      </div>
      <div class="form-row">
        <span class="label">昵称</span>
        <el-input v-model="profile.nickname" maxlength="30" style="width: 240px" />
        <el-button @click="saveProfile">保存昵称</el-button>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>服务器与点卡价</h3>
        <el-button size="small" type="primary" @click="openServer()">添加服务器</el-button>
      </div>
      <p class="hint">点卡价用来算每局成本；改动只影响之后新建的记录，已结算记录用的是当时的快照。</p>
      <el-table :data="servers" size="small">
        <el-table-column prop="name" label="服务器" min-width="140" />
        <el-table-column label="点卡单价（两/点）" width="180" align="right">
          <template #default="{ row }">{{ row.cardPrice.toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="openServer(row)">编辑</el-button>
            <el-button link type="danger" @click="removeServer(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card">
      <h3>记账偏好</h3>
      <div class="form-row">
        <span class="label">默认服务器</span>
        <el-select
          :model-value="app.settings?.defaultServerId ?? null"
          clearable
          placeholder="不指定"
          style="width: 220px"
          @update:model-value="(v: number | null) => patch({ defaultServerId: v })"
        >
          <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="label">默认号组</span>
        <el-select
          :model-value="app.settings?.defaultTeamId ?? null"
          clearable
          placeholder="不指定"
          style="width: 220px"
          @update:model-value="(v: number | null) => patch({ defaultTeamId: v })"
        >
          <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="label">跨零点日期修正</span>
        <el-switch
          :model-value="app.settings?.autoDateCorrect ?? true"
          @update:model-value="(v: string | number | boolean) => patch({ autoDateCorrect: Boolean(v) })"
        />
        <span class="hint inline">结算落在零点后时，把归属日期算到开始那天。</span>
      </div>
      <div class="form-row">
        <span class="label">关闭窗口时收进托盘</span>
        <el-switch
          :model-value="app.settings?.closeToTray ?? true"
          @update:model-value="(v: string | number | boolean) => patch({ closeToTray: Boolean(v) })"
        />
      </div>
      <div class="form-row">
        <span class="label">开机自动启动</span>
        <el-switch :model-value="autoLaunch" @update:model-value="(v: string | number | boolean) => toggleAutoLaunch(Boolean(v))" />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>一键初始化</h3>
        <el-button size="small" type="danger" plain @click="openInit">初始化</el-button>
      </div>
      <p class="hint">
        清空服务器、号组、角色、里程记录与物品价格，昵称和头像复位，等于恢复出厂设置。
        物品目录与活动规则保留。
      </p>
    </section>

    <el-dialog
      v-model="initDialog.visible"
      title="一键初始化"
      width="500px"
      :close-on-click-modal="false"
      @close="stopCountdown"
    >
      <div class="init-body">
        <p class="init-lead">确定要从本机删除这些数据？</p>
        <ul class="init-list">
          <li>服务器（含点卡单价）、号组、角色</li>
          <li>里程记录、明细、成本与每日统计</li>
          <li>物品在各服务器上的价格</li>
          <li>昵称恢复为「玩家」、头像清除、默认服务器与默认号组清空</li>
        </ul>
        <p class="init-warn">
          不可撤销，建议先到「关于 / 备份」导出备份。物品目录、活动规则、托盘与开机自启等偏好不受影响。
        </p>
        <div class="init-confirm">
          <span class="init-label">输入 <code>{{ CONFIRM_TEXT }}</code> 才能点确定：</span>
          <el-input v-model="initDialog.input" :placeholder="CONFIRM_TEXT" maxlength="10" />
        </div>
      </div>
      <template #footer>
        <el-button @click="closeInit">取消</el-button>
        <el-button type="danger" :loading="initializing" :disabled="!canConfirm" @click="doInit">
          {{ countdown > 0 ? `请稍等 ${countdown} 秒` : '确定清空' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="serverDialog.visible" :title="serverDialog.id ? '编辑服务器' : '添加服务器'" width="420px">
      <el-form label-width="110px">
        <el-form-item label="服务器名字" required>
          <el-input v-model="serverDialog.name" maxlength="30" />
        </el-form-item>
        <el-form-item label="点卡单价" required>
          <el-input-number v-model="serverDialog.cardPrice" :min="1" :step="100" :precision="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serverDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveServer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.settings {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head h2 {
  margin: 0;
  font-size: 20px;
}
.sub {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
.card {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  padding: 18px 20px;
  box-shadow: var(--card-shadow);
}
.card h3 {
  margin: 0 0 12px;
  font-size: 15px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-head h3 {
  margin: 0;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.avatar-row :deep(.el-avatar) {
  background: var(--surface-card);
  color: var(--accent-600);
  font-weight: 600;
  font-size: 20px;
  box-shadow: var(--elev-raised-sm);
}
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.label {
  width: 150px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: 0 0 10px;
}
.hint.inline {
  margin: 0;
}
code {
  background: var(--bg-raised);
  border-radius: 4px;
  padding: 1px 4px;
}
.init-body {
  font-size: 13px;
}
.init-lead {
  margin: 0 0 6px;
  color: var(--text-secondary);
}
.init-list {
  margin: 0 0 14px;
  padding-left: 18px;
  color: var(--text-secondary);
  line-height: 1.9;
}
.init-warn {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}
.init-confirm {
  margin-top: 14px;
}
.init-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>

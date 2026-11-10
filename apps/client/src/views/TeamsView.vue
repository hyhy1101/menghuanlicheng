<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { GameRoleDTO, GameTeamDTO, TeamCompareDTO } from '@lc/shared'
import { teamsApi } from '../api/dashboard'
import { serverApi } from '../api/basic'
import { fmtWan } from '../utils/format'
import CardHeader from '../components/CardHeader.vue'

type Team = GameTeamDTO
type Role = GameRoleDTO
interface ServerOption {
  id: number
  name: string
}

const router = useRouter()
const teams = ref<Team[]>([])
const compare = ref<TeamCompareDTO[]>([])
const roles = ref<Role[]>([])
const servers = ref<ServerOption[]>([])
const range = ref('THIS_WEEK')
const showCreateTeam = ref(false)
const showCreateRole = ref(false)
const newTeamName = ref('')
const newTeamServerId = ref<number | undefined>(undefined)
const newRole = ref({ name: '', level: 175, sect: '龙宫', teamId: undefined as number | undefined, serverId: undefined as number | undefined })

async function load() {
  try {
    const [t, c, r, s] = await Promise.all([teamsApi.list(), teamsApi.compare(range.value), teamsApi.roles(), serverApi.list()])
    teams.value = t.data.data
    compare.value = c.data.data
    roles.value = r.data.data
    servers.value = s.data.data.list
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function createTeam() {
  if (!newTeamName.value.trim()) {
    ElMessage.warning('请填写号组名称')
    return
  }
  if (!newTeamServerId.value) {
    ElMessage.warning('请选择服务器')
    return
  }
  try {
    await teamsApi.create(newTeamName.value.trim(), newTeamServerId.value)
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  newTeamName.value = ''
  newTeamServerId.value = undefined
  showCreateTeam.value = false
  ElMessage.success('号组已创建')
  await load()
}

async function createRole() {
  if (!newRole.value.name.trim()) {
    ElMessage.warning('请填写角色名')
    return
  }
  const body: { name: string; level: number; sect: string; teamId?: number; serverId?: number } = {
    name: newRole.value.name.trim(),
    level: newRole.value.level,
    sect: newRole.value.sect,
    teamId: newRole.value.teamId
  }
  if (!newRole.value.teamId) {
    if (!newRole.value.serverId) {
      ElMessage.warning('请选择服务器')
      return
    }
    body.serverId = newRole.value.serverId
  }
  try {
    await teamsApi.createRole(body)
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  newRole.value = { name: '', level: 175, sect: '龙宫', teamId: undefined, serverId: undefined }
  showCreateRole.value = false
  ElMessage.success('角色已创建')
  await load()
}

function teamServerName(teamId: number | undefined): string {
  const t = teams.value.find((x) => x.id === teamId)
  return t?.serverName ?? '—'
}

async function removeTeam(id: number) {
  try {
    await ElMessageBox.confirm('删除后组内角色将自动解绑，确定删除该号组？', '删除号组', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await teamsApi.remove(id)
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  ElMessage.success('号组已删除')
  await load()
}

async function removeRole(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该角色？', '删除角色', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await teamsApi.removeRole(id)
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  ElMessage.success('角色已删除')
  await load()
}

function recordWithTeam() {
  void router.push('/record')
}

onMounted(load)
</script>

<template>
  <div class="teams-page">
    <div class="page-head">
      <h2>角色 / 号组</h2>
      <div style="flex: 1" />
      <el-button type="primary" class="btn-primary" @click="showCreateRole = true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建角色
      </el-button>
      <el-button type="primary" class="btn-primary" @click="showCreateTeam = true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建号组
      </el-button>
    </div>

    <div class="team-grid">
      <div v-for="t in teams" :key="t.id" class="team-card">
        <div class="team-card-top">
          <span class="team-badge">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M4 19c0-2.5 2.2-4 5-4s5 1.5 5 4" />
            </svg>
          </span>
          <div class="team-head-meta">
            <div class="team-name">{{ t.name }}</div>
            <div class="team-meta">{{ t.serverName ? `${t.serverName} · ${t.roleCount} 个角色` : `${t.roleCount} 个角色` }}</div>
          </div>
        </div>
        <div class="team-stats">
          <div class="ts-item">
            <span>今日收益</span>
            <b class="num gold">{{ fmtWan(t.todayIncome) }}万</b>
          </div>
          <div class="ts-item">
            <span>本周净收益</span>
            <b class="num green">{{ fmtWan(t.weekNetIncome) }}万</b>
          </div>
          <div class="ts-item">
            <span>效率</span>
            <b class="num">{{ fmtWan(t.netEfficiency) }}万/h</b>
          </div>
        </div>
        <div class="team-actions">
          <el-button type="primary" class="btn-gold" @click="recordWithTeam">开始记账</el-button>
          <el-button class="btn-ghost" @click="removeTeam(t.id)">删除</el-button>
        </div>
      </div>
      <div class="team-card empty-card" @click="showCreateTeam = true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>新建号组</span>
      </div>
    </div>

    <div class="card">
      <CardHeader icon="M4 19V5m5 14V9m5 10V3m5 16v-7">
        <template #title>组间效率对比</template>
        <template #extra>
          <el-segmented
            v-model="range"
            class="range-seg"
            :options="[
              { label: '本周', value: 'THIS_WEEK' },
              { label: '本月', value: 'THIS_MONTH' },
              { label: '全部', value: 'ALL' }
            ]"
            @change="load"
          />
        </template>
      </CardHeader>
      <el-table :data="compare" class="lc-table">
        <el-table-column label="#" width="56">
          <template #default="{ $index }">
            <span class="rank" :class="{ top: $index === 0 }">{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="teamName" label="号组" min-width="140" />
        <el-table-column label="服务器" width="120">
          <template #default="{ row }">
            <span class="muted">{{ row.serverName ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="roleCount" label="角色数" width="90" />
        <el-table-column label="净收益" width="130">
          <template #default="{ row }">
            <span class="green num">{{ fmtWan(row.netIncome) }}万</span>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="110">
          <template #default="{ row }">
            <span class="num">{{ (row.durationMinutes / 60).toFixed(1) }}h</span>
          </template>
        </el-table-column>
        <el-table-column label="效率" min-width="120">
          <template #default="{ row }">
            <span class="gold num">{{ fmtWan(row.netEfficiency) }}万/h</span>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="60" /></template>
      </el-table>
    </div>

    <div class="card">
      <CardHeader icon="M12 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 12c0-3 3-5 7-5s7 2 7 5">
        <template #title>角色明细</template>
      </CardHeader>
      <el-table :data="roles" class="lc-table">
        <el-table-column prop="name" label="角色名" min-width="120" />
        <el-table-column prop="sect" label="门派" width="110" />
        <el-table-column prop="level" label="等级" width="90" />
        <el-table-column label="所属号组" min-width="130">
          <template #default="{ row }">
            <span v-if="row.teamName" class="team-chip">{{ row.teamName }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="服务器" min-width="110">
          <template #default="{ row }">
            <span class="muted">{{ row.serverName ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="removeRole(row.id)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无角色" :image-size="60" /></template>
      </el-table>
    </div>

    <el-dialog v-model="showCreateTeam" title="新建号组" width="420px" align-center>
      <div class="dlg-form">
        <el-input
          v-model="newTeamName"
          placeholder="如：175五开组"
          clearable
          @keyup.enter="createTeam"
        />
        <el-select v-model="newTeamServerId" placeholder="选择服务器（可搜索）" class="dlg-select" filterable>
          <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="showCreateTeam = false">取消</el-button>
        <el-button type="primary" @click="createTeam">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreateRole" title="新建角色" width="420px" align-center>
      <div class="dlg-form">
        <el-input v-model="newRole.name" placeholder="角色名" clearable />
        <div class="row">
          <el-input v-model.number="newRole.level" type="number" placeholder="等级" />
          <el-input v-model="newRole.sect" placeholder="门派" />
        </div>
        <el-select v-model="newRole.teamId" placeholder="不归属号组" class="dlg-select" clearable>
          <el-option
            v-for="t in teams"
            :key="t.id"
            :label="t.serverName ? `${t.name}（${t.serverName}）` : t.name"
            :value="t.id"
          />
        </el-select>
        <template v-if="newRole.teamId">
          <div class="server-hint">角色将归属「{{ teamServerName(newRole.teamId) }}」</div>
        </template>
        <template v-else>
          <el-select v-model="newRole.serverId" placeholder="选择服务器（单开，可搜索）" class="dlg-select" filterable>
            <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </template>
      </div>
      <template #footer>
        <el-button @click="showCreateRole = false">取消</el-button>
        <el-button type="primary" @click="createRole">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.teams-page {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.btn-primary {
  height: 40px;
  margin: 0;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: var(--radius-control);
  border: none;
  font-weight: 600;
  font-size: 14px;
  background: var(--accent-500);
  color: var(--on-accent);
  box-shadow: 0 3px 14px rgb(var(--accent-rgb) / 0.3);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 20px rgb(var(--accent-rgb) / 0.42);
  background: var(--accent-500);
  color: var(--on-accent);
}
/* ---- 号组卡片 ---- */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}
.team-card {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.team-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--elev-raised);
}
.team-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.team-badge {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-600);
  background: var(--surface-card);
  box-shadow: var(--elev-inset-sm);
}
.team-head-meta {
  min-width: 0;
}
.team-name {
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-meta {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 1px;
}
.team-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.ts-item {
  background: var(--surface-card);
  border: 0;
  border-radius: 12px;
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--elev-inset-sm);
}
.ts-item span {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.ts-item b {
  font-size: 13px;
  white-space: nowrap;
}
.team-actions {
  display: flex;
  gap: 8px;
}
.empty-card {
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  cursor: pointer;
  border-style: dashed;
  min-height: 180px;
  font-size: 14px;
}
.empty-card svg {
  opacity: 0.5;
}
.empty-card:hover {
  border-color: rgb(var(--accent-rgb) / 0.5);
  color: var(--ink-accent);
  transform: translateY(-3px);
}
.empty-card:hover svg {
  opacity: 0.9;
}
/* ---- 卡片通用 ---- */
.card {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  padding: 18px;
  box-shadow: var(--card-shadow);
}
/* el-segmented */
.range-seg {
  border: 0;
  border-radius: var(--radius-control);
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
.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  background: var(--surface-card);
  color: var(--text-muted);
  box-shadow: var(--elev-raised-xs);
}
.rank.top {
  background: var(--accent-500);
  color: var(--on-accent);
  box-shadow: none;
}
.gold {
  color: var(--accent-500);
}
.green {
  color: var(--positive);
}
.muted {
  color: var(--text-muted);
}
.team-chip {
  display: inline-block;
  font-size: 12px;
  color: var(--accent-600);
  padding: 3px 11px;
  border-radius: var(--radius-pill);
  background: rgb(var(--accent-rgb) / 0.1);
}
/* ---- 按钮 ---- */
.btn-gold,
.btn-ghost {
  margin: 0;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-control);
  font-weight: 600;
  font-size: 13px;
}
.btn-gold {
  background: var(--accent-500);
  border: none;
  color: var(--on-accent);
  flex: 1;
  box-shadow: 0 3px 12px rgb(var(--accent-rgb) / 0.28);
}
.btn-gold:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgb(var(--accent-rgb) / 0.38);
  background: var(--accent-500);
  color: var(--on-accent);
}
.btn-ghost {
  border: 0;
  background: var(--surface-card);
  color: var(--text-secondary);
  box-shadow: var(--elev-raised-xs);
}
.btn-ghost:hover {
  color: var(--text-primary);
  box-shadow: var(--elev-hover);
}
.btn-ghost:active {
  box-shadow: var(--elev-pressed);
}
/* ---- 弹窗表单 ---- */
.dlg-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  gap: 12px;
}
.dlg-select {
  width: 100%;
}
.server-hint {
  font-size: 12px;
  color: var(--text-muted);
}
</style>

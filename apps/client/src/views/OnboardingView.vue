<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { serverApi } from '../api/basic'
import { teamsApi } from '../api/dashboard'
import { useAppStore } from '../stores/app'

/**
 * 首次启动三步向导：① 加服务器 → ② 建号组和角色（可跳过）→ ③ 完成。
 * 完成后 onboardingDone 落库，永不再弹。
 */
const router = useRouter()
const app = useAppStore()

const step = ref(0)
const busy = ref(false)
const autoLaunch = ref(false)

const server = reactive({ name: '', cardPrice: 12800 })
const team = reactive({ name: '我的号组' })
const roles = ref<Array<{ name: string; sect: string; level: number }>>([
  { name: '', sect: '大唐官府', level: 175 }
])

let serverId: number | null = null
let teamId: number | null = null

function addRole() {
  roles.value.push({ name: '', sect: '大唐官府', level: 175 })
}
function removeRole(i: number) {
  roles.value.splice(i, 1)
}

async function nextFromServer() {
  const name = server.name.trim()
  if (!name) return ElMessage.warning('先填一个服务器名字')
  if (!Number.isFinite(server.cardPrice) || server.cardPrice <= 0) {
    return ElMessage.warning('点卡单价要大于 0')
  }
  busy.value = true
  try {
    const { data } = await serverApi.create({
      name,
      cardPrice: Math.round(server.cardPrice),
      region: '本地'
    })
    serverId = data.data.id
    await app.saveSettings({ defaultServerId: serverId })
    step.value = 1
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function createTeam() {
  if (serverId == null) return
  const name = team.name.trim()
  if (!name) return ElMessage.warning('号组名字不能为空')
  busy.value = true
  try {
    const { data } = await teamsApi.create(name, serverId)
    teamId = data.data.id
    const list = roles.value
      .map((r) => ({ ...r, name: r.name.trim() }))
      .filter((r) => r.name)
    if (list.length) await teamsApi.batchRoles({ teamId, roles: list })
    await app.saveSettings({ defaultTeamId: teamId })
    step.value = 2
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

/** 跳过建号组：只要求服务器已经建好 */
function skipTeam() {
  step.value = 2
}

async function finish() {
  busy.value = true
  try {
    if (autoLaunch.value) await window.lc.setAutoLaunch(true)
    await app.saveSettings({ onboardingDone: true })
    await router.replace('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="onboarding">
    <div class="panel">
      <div class="brand">
        <div class="brand-badge">梦</div>
        <div>
          <h1>欢迎使用梦幻里程</h1>
          <p class="sub">单机运行，数据只存在这台电脑上。</p>
        </div>
      </div>

      <el-steps :active="step" align-center finish-status="success" class="steps">
        <el-step title="添加服务器" />
        <el-step title="号组与角色" />
        <el-step title="完成" />
      </el-steps>

      <!-- ① 服务器 -->
      <section v-if="step === 0" class="body">
        <p class="hint">先填你常玩的服务器。点卡价用来折算每局成本，之后可在设置里修改。</p>
        <el-form label-position="top">
          <el-form-item label="服务器名字" required>
            <el-input v-model="server.name" placeholder="例如：长安城" maxlength="30" />
          </el-form-item>
          <el-form-item label="点卡单价（两 / 点）" required>
            <el-input-number v-model="server.cardPrice" :min="1" :step="100" :precision="0" controls-position="right" style="width: 100%" />
          </el-form-item>
        </el-form>
        <div class="actions">
          <el-button type="primary" :loading="busy" @click="nextFromServer">下一步</el-button>
        </div>
      </section>

      <!-- ② 号组 -->
      <section v-else-if="step === 1" class="body">
        <p class="hint">一个号组就是同时开的一队角色。现在不建也行，之后在「号组」页随时补。</p>
        <el-form label-position="top">
          <el-form-item label="号组名字" required>
            <el-input v-model="team.name" maxlength="30" />
          </el-form-item>
        </el-form>
        <div class="roles">
          <div class="roles-head">
            <span>角色（可留空，之后再加）</span>
            <el-button link type="primary" @click="addRole">+ 加一个角色</el-button>
          </div>
          <div v-for="(r, i) in roles" :key="i" class="role-row">
            <el-input v-model="r.name" placeholder="角色名" maxlength="20" />
            <el-input v-model="r.sect" placeholder="门派" maxlength="20" />
            <el-input-number v-model="r.level" :min="1" :max="200" :precision="0" controls-position="right" />
            <el-button link type="danger" @click="removeRole(i)">删除</el-button>
          </div>
        </div>
        <div class="actions">
          <el-button :disabled="busy" @click="skipTeam">跳过</el-button>
          <el-button type="primary" :loading="busy" @click="createTeam">创建并继续</el-button>
        </div>
      </section>

      <!-- ③ 完成 -->
      <section v-else class="body">
        <div class="done">
          <div class="done-badge">✓</div>
          <h2>准备好了</h2>
          <p class="hint">随时可以在右上角菜单里进入设置与备份。</p>
        </div>
        <el-checkbox v-model="autoLaunch">开机自动启动（默认不勾选）</el-checkbox>
        <div class="actions">
          <el-button type="primary" :loading="busy" @click="finish">进入主界面</el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  position: relative;
  z-index: 1;
}
.panel {
  width: 640px;
  max-width: 100%;
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  box-shadow: var(--elev-float);
  padding: 32px 36px 28px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}
.brand-badge {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--sans-font);
  font-size: 20px;
  font-weight: 600;
  color: var(--on-accent);
  background: var(--accent-500);
  box-shadow: 0 4px 14px rgb(var(--accent-rgb) / 0.35);
}
h1 {
  margin: 0;
  font-size: 20px;
}
.sub {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
.steps {
  margin: 6px 0 18px;
}
.body {
  min-height: 300px;
  display: flex;
  flex-direction: column;
}
.hint {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0 0 14px;
}
.roles {
  margin-bottom: 8px;
}
.roles-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.role-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 140px auto;
  gap: 8px;
  margin-bottom: 8px;
}
.actions {
  margin-top: auto;
  padding-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.done {
  text-align: center;
  padding: 16px 0 26px;
}
.done-badge {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--on-accent);
  background: var(--accent-500);
}
h2 {
  margin: 0 0 8px;
}
</style>

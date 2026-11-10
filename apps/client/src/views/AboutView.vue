<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UPDATE_REPO } from '@lc/shared'
import { useAppStore } from '../stores/app'
import type { BackupFile, UpdateCheckResult } from '../types/bridge'

const app = useAppStore()

const version = ref('—')
const dbFile = ref('')
const userData = ref('')
const backups = ref<BackupFile[]>([])
const loadingBackups = ref(false)

const checking = ref(false)
const updateResult = ref<UpdateCheckResult | null>(null)

/** 仓库地址写死在程序里（shared/constants.ts），不再从设置读取 */
const repo = () => UPDATE_REPO

async function loadInfo() {
  const info = await app.loadInfo()
  if (!info) return
  version.value = info.version
  dbFile.value = info.dbFile
  userData.value = info.userData
}

async function loadBackups() {
  loadingBackups.value = true
  try {
    backups.value = await window.lc.backup.list()
  } finally {
    loadingBackups.value = false
  }
}

async function exportBackup() {
  const res = await window.lc.backup.export()
  if (!res.ok) {
    if (res.msg && res.msg !== '已取消') ElMessage.error(res.msg)
    return
  }
  ElMessage.success('已导出到 ' + res.data)
}

async function restoreBackup(file?: BackupFile) {
  // 恢复会覆盖当前库并由主进程弹确认框；这里只负责发起
  const res = await window.lc.backup.restore(file?.path)
  if (!res.ok && res.msg && res.msg !== '已取消') ElMessage.error(res.msg)
}

async function checkUpdate() {
  if (!repo()) return ElMessage.warning('先在设置里填写更新仓库（owner/repo）')
  checking.value = true
  updateResult.value = null
  try {
    const res = await window.lc.checkUpdate(repo())
    if (!res.ok) {
      ElMessage.error(res.msg)
      return
    }
    updateResult.value = res.data
  } catch (e) {
    // 主进程异常（如 IPC 出错）也要给个提示，不能只留一个转圈
    ElMessage.error((e as Error).message || '检查更新失败')
  } finally {
    checking.value = false
  }
}

async function openRelease(url: string) {
  const res = await window.lc.openExternal(url)
  if (!res.ok) ElMessage.error(res.msg || '打不开链接')
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

onMounted(async () => {
  await Promise.all([loadInfo(), loadBackups()])
})
</script>

<template>
  <div class="about">
    <header class="page-head">
      <h2>关于 / 备份</h2>
      <p class="sub">梦幻里程 · 单机离线版。没有账号，没有云同步，数据只在这台电脑上。</p>
    </header>

    <section class="card">
      <h3>版本</h3>
      <div class="kv"><span>当前版本</span><b>{{ version }}</b></div>
      <div class="kv"><span>数据文件</span><code class="selectable">{{ dbFile || '—' }}</code></div>
      <div class="kv"><span>数据目录</span><code class="selectable">{{ userData || '—' }}</code></div>
      <div class="update-row">
        <el-button :loading="checking" @click="checkUpdate">检查更新</el-button>
        <span class="hint">仅在点击时请求一次 GitHub Release。</span>
      </div>
      <div v-if="updateResult" class="update-result">
        <template v-if="updateResult.hasUpdate">
          发现新版本 <b>{{ updateResult.latestVersion }}</b>（当前 {{ updateResult.currentVersion }}）
          <el-button link type="primary" @click="openRelease(updateResult.url)">打开 Release 页面</el-button>
          <p v-if="updateResult.notes" class="notes">{{ updateResult.notes }}</p>
        </template>
        <template v-else>已是最新版本（{{ updateResult.currentVersion }}）。</template>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>备份</h3>
        <div>
          <el-button size="small" @click="exportBackup">导出备份</el-button>
          <el-button size="small" type="primary" @click="restoreBackup()">从文件恢复</el-button>
        </div>
      </div>
      <p class="hint">
        每天首次启动会自动留一份，滚动保留 7 份。恢复前会把当前数据另存为
        <code>data-before-restore.db</code>，然后自动重启。
      </p>
      <el-table v-loading="loadingBackups" :data="backups" size="small">
        <el-table-column prop="name" label="文件名" min-width="180" />
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column label="大小" width="110" align="right">
          <template #default="{ row }">{{ fmtSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="restoreBackup(row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!backups.length && !loadingBackups" class="empty">还没有自动备份。</div>
    </section>

    <section class="card">
      <h3>说明</h3>
      <p class="hint">
        本软件为本地工具，与游戏官方无关；活动时间等内置数据仅为初始值，请以游戏内公告为准。
        项目以 MIT 协议开源。
      </p>
    </section>
  </div>
</template>

<style scoped>
.about {
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
  margin-bottom: 10px;
}
.card-head h3 {
  margin: 0;
}
.kv {
  display: flex;
  gap: 14px;
  font-size: 13px;
  margin-bottom: 8px;
  align-items: baseline;
}
.kv span {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.kv code {
  word-break: break-all;
  background: var(--bg-raised);
  padding: 2px 6px;
  border-radius: 4px;
}
.update-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.update-result {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
.notes {
  margin: 8px 0 0;
  white-space: pre-wrap;
  color: var(--text-muted);
  font-size: 12px;
  max-height: 160px;
  overflow: auto;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: 0 0 10px;
}
code {
  background: var(--bg-raised);
  padding: 1px 4px;
  border-radius: 4px;
}
.empty {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}
</style>

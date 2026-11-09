<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { THEME_ACCENTS } from '../themes'
import { profileApi } from '../api/basic'
import { assetUrl } from '../utils/asset'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()

const nickname = ref('玩家')
const avatar = ref<string | null>(null)

const navs = [
  { path: '/', label: '主页', icon: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10' },
  {
    path: '/records',
    label: '记录列表',
    icon: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
  },
  {
    path: '/teams',
    label: '号组',
    icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M4 19c0-2.5 2.2-4 5-4s5 1.5 5 4m3-5.5c1.7.5 3 1.8 3 3.5'
  },
  { path: '/analysis', label: '分析', icon: 'M4 20V10m5.5 10V4m5.5 16v-8m5 8V7' },
  {
    path: '/activities',
    label: '活动',
    icon: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 7h3v3H8v-3Z'
  },
  {
    path: '/items',
    label: '物品信息',
    icon: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Zm0 0 8 4.5m8-4.5L12 12m0 0v9'
  }
]

const today = computed(() => {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`
})

const initial = computed(() => (nickname.value || '玩')[0])

function goRecord() {
  void router.push('/record')
}

function handleUserCommand(command: string) {
  if (command === 'settings' || command === 'about') void router.push(`/${command}`)
}

onMounted(async () => {
  try {
    const { data } = await profileApi.get()
    nickname.value = data.data.nickname || '玩家'
    avatar.value = assetUrl(data.data.avatar)
  } catch {
    /* 档案还没建好时用默认昵称 */
  }
})
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="logo">
        <div class="logo-badge">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" />
            <path d="M12 2v20M21 7l-9 5M3 7l9 5" />
          </svg>
        </div>
        <div class="logo-text">
          <div class="logo-name">梦幻里程</div>
          <div class="logo-sub">Fantasy Ledger</div>
        </div>
      </div>

      <nav class="nav">
        <div
          v-for="n in navs"
          :key="n.path"
          class="nav-item"
          :class="{ on: route.path === n.path }"
          @click="router.push(n.path)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path :d="n.icon" />
          </svg>
          <span>{{ n.label }}</span>
        </div>
      </nav>

      <div class="spacer" />

      <span class="date">{{ today }}</span>

      <el-popover trigger="click" :width="224" popper-class="theme-pop">
        <template #reference>
          <button class="theme-btn" title="主题设置">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7.8Zm-6 9a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.5-3.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.5 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
            </svg>
          </button>
        </template>
        <div class="theme-panel">
          <div class="theme-row">
            <span class="theme-label">显示模式</span>
            <el-switch
              :model-value="theme.mode === 'light'"
              inline-prompt
              active-text="亮"
              inactive-text="暗"
              @change="theme.toggleMode()"
            />
          </div>
          <div class="theme-row">
            <span class="theme-label">主题色</span>
            <div class="swatches">
              <button
                v-for="t in THEME_ACCENTS"
                :key="t.id"
                class="swatch"
                :class="{ on: theme.accent === t.id }"
                :style="{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[2]})` }"
                :title="t.name"
                @click="theme.setAccent(t.id)"
              />
            </div>
          </div>
        </div>
      </el-popover>

      <el-button type="primary" class="btn-record" @click="goRecord">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        开始里程
      </el-button>

      <el-dropdown trigger="click" @command="handleUserCommand">
        <div class="user-box" tabindex="0">
          <el-avatar :size="30" class="avatar" :src="avatar ?? undefined">{{ initial }}</el-avatar>
          <span class="user-name">{{ nickname }}</span>
          <svg class="caret" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="settings">设置</el-dropdown-item>
            <el-dropdown-item command="about">关于 / 备份</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}
/* 顶栏与页面同色，用一条向下的柔和投影把自己「抬」起来，不用描边 */
.topbar {
  flex-shrink: 0;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  background: var(--surface-page);
  box-shadow: 0 8px 16px -12px var(--shade);
  position: relative;
  z-index: 2;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  padding-right: 18px;
  margin-right: 4px;
  flex-shrink: 0;
}
/* 标志也做成一枚凸起的键帽，只有图标本身用品牌色 */
.logo-badge {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-500);
  background: var(--surface-card);
  box-shadow: var(--elev-raised-sm);
}
.logo-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--sans-font);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
}
.logo-sub {
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  margin-top: 1px;
  white-space: nowrap;
}
/*
 * 顶部导航 = 新拟物键帽
 *
 * 三种状态共用一套「左上受光 / 右下投影」的光影：
 *   静置  外阴影，键帽浮在面板上
 *   悬停  外阴影加深 + 上浮 1px
 *   按下  外阴影换内阴影，键帽沉下去 2px；松手用带回弹的缓动弹回
 * 当前页 (.on) 常驻按下态，底部亮一颗主题色指示灯。
 *
 * 光影基色按明暗主题分别取值 —— 新拟物最怕两边都用纯黑纯白，
 * 亮色底给暖白高光 + 暖棕投影，暗色底给极淡白高光 + 深黑投影。
 */
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
  /* 键帽与底色同色，光影直接用全局的 shade / glow */
  --key-light: var(--glow);
  --key-dark: var(--shade);
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 10px;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  user-select: none;
  background: var(--surface-card);
  box-shadow:
    -2px -2px 5px var(--key-light),
    2px 2px 5px var(--key-dark);
  /* 松手回弹：位移用带回弹的缓动，阴影跟随得稳一些 */
  transition:
    transform 0.34s cubic-bezier(0.2, 1.55, 0.4, 1),
    box-shadow 0.22s ease-out,
    color 0.18s;
}
.nav-item svg {
  flex-shrink: 0;
  opacity: 0.85;
}
/* 悬停：模糊减半 + 上浮 1px，模拟手靠近遮光 */
.nav-item:hover {
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow:
    -3px -3px 7px var(--key-light),
    3px 5px 10px var(--key-dark);
}
/* 按下：外阴影收成内阴影，键帽下沉 2px；瞬时响应，回弹交给上面那条 transition */
.nav-item:active {
  transform: translateY(2px);
  box-shadow:
    inset 2px 2px 5px var(--key-dark),
    inset -2px -2px 5px var(--key-light);
  transition-duration: 0.06s;
  color: var(--text-primary);
}
/* 当前页：常驻按下态 + 主题色指示灯（不换底色） */
.nav-item.on {
  transform: translateY(2px);
  color: var(--accent-600);
  font-weight: 600;
  box-shadow:
    inset 2px 2px 5px var(--key-dark),
    inset -2px -2px 5px var(--key-light);
}
html.dark .nav-item.on {
  color: var(--ink-accent);
}
.nav-item.on svg {
  opacity: 1;
}
.nav-item.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: var(--accent-500);
  box-shadow: 0 0 6px 1px rgb(var(--accent-rgb) / 0.6);
}
/* 当前页再被按下：比常驻态再沉一点，反馈不丢 */
.nav-item.on:active {
  transform: translateY(3px);
  box-shadow:
    inset 3px 3px 7px var(--key-dark),
    inset -2px -2px 5px var(--key-light);
}
.spacer {
  flex: 1;
}
.date {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 主行动：唯一一块压在基底上的饱和色，配一层品牌色辉光 */
.btn-record {
  height: 38px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-control);
  background: var(--accent-500);
  border: none;
  color: var(--on-accent);
  box-shadow: 0 3px 12px rgb(var(--accent-rgb) / 0.3);
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    background-color var(--dur-2) ease;
}
.btn-record:hover {
  box-shadow: 0 6px 20px rgb(var(--accent-rgb) / 0.42);
  background: var(--accent-500);
  color: var(--on-accent);
}
.btn-record:active {
  background: var(--accent-600);
  box-shadow: 0 1px 6px rgb(var(--accent-rgb) / 0.3);
}
/* 用户区：一枚凸起的胶囊，悬停时阴影收窄 */
.user-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 5px;
  background: var(--surface-card);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  outline: none;
  box-shadow: var(--elev-raised-xs);
  transition: box-shadow var(--dur-3) var(--ease-out);
}
.user-box:hover {
  box-shadow: var(--elev-hover);
}
.avatar {
  flex-shrink: 0;
  background: var(--accent-500) !important;
  color: var(--on-accent) !important;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 6px rgb(var(--accent-rgb) / 0.35);
}
.user-name {
  font-size: 13px;
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  color: var(--text-muted);
  flex-shrink: 0;
}
.theme-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 0;
  background: var(--surface-card);
  color: var(--text-secondary);
  cursor: pointer;
  outline: none;
  box-shadow: var(--elev-raised-xs);
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    color var(--dur-2) ease;
}
.theme-btn:hover {
  box-shadow: var(--elev-hover);
  color: var(--accent-500);
}
.theme-btn:active {
  box-shadow: var(--elev-pressed);
}
.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.theme-label {
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.swatches {
  display: flex;
  gap: 8px;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  outline: none;
  padding: 0;
  transition: transform 0.15s, box-shadow 0.15s;
}
.swatch:hover {
  transform: scale(1.12);
}
.swatch.on {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.3);
}
/* 新拟物的两套阴影不能贴太近，内容区留出比原来更大的呼吸边 */
.content {
  flex: 1;
  overflow: auto;
  padding: 28px 32px 32px;
}
</style>

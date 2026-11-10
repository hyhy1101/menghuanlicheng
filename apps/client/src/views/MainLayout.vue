<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { THEME_ACCENTS, THEME_STYLES } from '../themes'
import type { ThemeStyle } from '../themes'
import { useAppStore } from '../stores/app'
import { assetUrl } from '../utils/asset'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()
const app = useAppStore()

// 档案在 store 里，设置页改完昵称、或一键初始化复位后这里会立即跟着变
const nickname = computed(() => app.profile?.nickname || '玩家')
const avatar = computed(() => assetUrl(app.profile?.avatar ?? null))

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

// 三套固定配色的风格各自锁死显示模式与主题色，提示文案要跟着风格走
const STYLE_HINTS: Record<ThemeStyle, string> = {
  neumorphic: '',
  soft: '柔和界面风按规范固定亮色与靛蓝主色。',
  glass: '玻璃拟态按规范固定暗色与香槟金主色。',
  playful: '俏皮野兽派按规范固定亮色与珊瑚红主色。'
}
const styleHint = computed(() => STYLE_HINTS[theme.style])

function goRecord() {
  void router.push('/record')
}

function handleUserCommand(command: string) {
  if (command === 'settings' || command === 'about') void router.push(`/${command}`)
}

onMounted(() => {
  // 档案还没建好时 store 里是 null，模板会退回默认昵称
  void app.loadProfile()
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

      <el-popover trigger="click" :width="340" popper-class="theme-pop">
        <template #reference>
          <button class="theme-btn" title="主题设置">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7.8Zm-6 9a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.5-3.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.5 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
            </svg>
          </button>
        </template>
        <div class="theme-panel">
          <div class="theme-row">
            <span class="theme-label">界面风格</span>
            <div class="style-opts">
              <button
                v-for="s in THEME_STYLES"
                :key="s.id"
                class="style-opt"
                :class="{ on: theme.style === s.id }"
                :title="s.desc"
                @click="theme.setStyle(s.id)"
              >
                {{ s.name }}
              </button>
            </div>
          </div>
          <div class="theme-row">
            <span class="theme-label">显示模式</span>
            <el-switch
              :model-value="theme.mode === 'light'"
              :disabled="!theme.canToggleMode"
              inline-prompt
              active-text="亮"
              inactive-text="暗"
              @change="theme.toggleMode()"
            />
          </div>
          <div v-if="theme.canPickAccent" class="theme-row">
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
          <p v-else class="theme-hint">{{ styleHint }}</p>
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

/* ===== 主题设置面板：界面风格切换（两种风格下都要好看） ===== */
.style-opts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.style-opt {
  padding: 5px 10px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--ink-3);
  font-family: var(--sans-font);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--elev-raised-xs);
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    background-color var(--dur-2) ease,
    color var(--dur-2) ease;
}
.style-opt:hover {
  color: var(--ink-1);
  box-shadow: var(--elev-hover);
}
/* 主题一沿用新拟物的「按下」语义：选中 = 凹槽，不抢占主行动的那一抹饱和色 */
.style-opt.on {
  color: var(--accent-600);
  font-weight: 600;
  box-shadow: var(--elev-pressed);
}
/* 柔和风格里选项退成雾灰底的分段控件，选中项才是实心靛蓝 */
html[data-style='soft'] .style-opt {
  background: var(--sunken);
  box-shadow: none;
}
html[data-style='soft'] .style-opt:hover {
  background: #e8eef7;
  color: var(--ink-1);
  box-shadow: none;
}
html[data-style='soft'] .style-opt.on {
  background: var(--accent-500);
  color: var(--on-accent);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.28);
}
.theme-hint {
  margin: 0;
  color: var(--ink-4);
  font-size: 12px;
  line-height: 1.5;
}

/* ============================================================================
   主题二：柔和界面风 —— 顶栏与导航

   新拟物键帽靠「同色 + 明暗阴影」表达，柔和风格里改成透明胶囊：
   悬停淡靛蓝底、当前页靛蓝 10% 底 + 深靛蓝字，按下去轻微缩放。
   ============================================================================ */
html[data-style='soft'] .topbar {
  background: var(--surface-card);
  box-shadow: 0 8px 24px rgba(148, 163, 184, 0.18);
}
html[data-style='soft'] .logo-badge {
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.1);
  box-shadow: none;
}
html[data-style='soft'] .nav-item {
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-3);
  box-shadow: none;
  transition:
    background-color var(--dur-3) ease,
    color var(--dur-2) ease,
    transform var(--dur-3) ease;
}
html[data-style='soft'] .nav-item:hover {
  background: rgba(99, 102, 241, 0.08);
  color: var(--ink-1);
  transform: none;
  box-shadow: none;
}
html[data-style='soft'] .nav-item:active {
  transform: scale(0.97);
  box-shadow: none;
}
html[data-style='soft'] .nav-item.on,
html[data-style='soft'] .nav-item.on:active {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent-600);
  transform: none;
  box-shadow: none;
}
html[data-style='soft'] .nav-item.on::after {
  display: none;
}
html[data-style='soft'] .btn-record {
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.25);
  transition:
    box-shadow var(--dur-3) ease,
    transform var(--dur-3) ease,
    background-color var(--dur-2) ease;
}
html[data-style='soft'] .btn-record:hover {
  background: var(--accent-500);
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(99, 102, 241, 0.35);
}
html[data-style='soft'] .btn-record:active {
  background: var(--accent-600);
  transform: scale(0.96);
  box-shadow: inset 0 4px 10px rgba(67, 56, 202, 0.28);
}
html[data-style='soft'] .user-box {
  background: var(--surface-card);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.18);
  transition:
    box-shadow var(--dur-3) ease,
    transform var(--dur-3) ease;
}
html[data-style='soft'] .user-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(100, 116, 139, 0.22);
}
html[data-style='soft'] .theme-btn {
  background: var(--surface-card);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.18);
  transition:
    box-shadow var(--dur-3) ease,
    transform var(--dur-3) ease,
    color var(--dur-2) ease;
}
html[data-style='soft'] .theme-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(100, 116, 139, 0.22);
  color: var(--accent-500);
}
html[data-style='soft'] .theme-btn:active {
  transform: scale(0.96);
  box-shadow: inset 0 3px 8px rgba(100, 116, 139, 0.22);
}
html[data-style='soft'] .avatar {
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.28);
}
@media (prefers-reduced-motion: reduce) {
  html[data-style='soft'] .nav-item,
  html[data-style='soft'] .nav-item:hover,
  html[data-style='soft'] .nav-item:active,
  html[data-style='soft'] .user-box:hover,
  html[data-style='soft'] .theme-btn:hover {
    transition: none;
    transform: none;
  }
}

/* ============================================================================
   主题三：玻璃拟态 —— 顶栏与导航

   顶栏是一条 72px 高的夜色玻璃带：4% 白 + 24px 模糊，只有底边一条 10% 的
   结构线。导航退成透明链接，当前页靠一段白色高光与一颗香槟金指示灯标出，
   不抢占主行动那枚香槟金胶囊。
   ============================================================================ */
html[data-style='glass'] .topbar {
  background: rgba(11, 19, 34, 0.55);
  box-shadow: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
}
html[data-style='glass'] .logo-badge {
  border-radius: 16px;
  color: var(--ink-3);
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(2, 6, 16, 0.35);
}
html[data-style='glass'] .logo-name {
  color: #ffffff;
}
html[data-style='glass'] .nav-item {
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-3);
  box-shadow: none;
  transition:
    background-color var(--dur-4) var(--ease-out),
    color var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out);
}
html[data-style='glass'] .nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  transform: none;
  box-shadow: none;
}
html[data-style='glass'] .nav-item:active {
  background: rgba(255, 255, 255, 0.1);
  transform: none;
  box-shadow: none;
  transition-duration: 0ms;
}
/* 用 html.dark 前缀压住上面那条 `html.dark .nav-item.on`（同文件里权重更高） */
html.dark[data-style='glass'] .nav-item.on,
html.dark[data-style='glass'] .nav-item.on:active {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
/* 当前页指示灯：全站唯一允许出现在内容区之外的香槟金 */
html[data-style='glass'] .nav-item.on::after {
  background: var(--accent-500);
  box-shadow: 0 0 8px 1px rgba(228, 184, 99, 0.55);
}
html[data-style='glass'] .date {
  color: var(--ink-3);
}
/* 主行动：香槟金实心胶囊，悬停上浮 1px 并叠一层金色光晕 */
html[data-style='glass'] .btn-record {
  border-radius: var(--radius-pill);
  background: var(--accent-500);
  color: #060a13;
  box-shadow:
    0 10px 24px rgba(228, 184, 99, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition:
    background-color var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out),
    transform var(--dur-4) var(--ease-out);
}
html[data-style='glass'] .btn-record:hover {
  background: rgba(228, 184, 99, 0.92);
  color: #060a13;
  transform: translateY(-1px);
  box-shadow:
    0 12px 32px rgba(228, 184, 99, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
html[data-style='glass'] .btn-record:active {
  background: var(--accent-500);
  color: #060a13;
  transform: translateY(0) scale(0.98);
  box-shadow: inset 0 2px 8px rgba(120, 88, 20, 0.45);
}
html[data-style='glass'] .user-box {
  background: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 8px 24px rgba(3, 7, 18, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  transition:
    background-color var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out);
}
html[data-style='glass'] .user-box:hover {
  background: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 16px 40px rgba(3, 7, 18, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}
html[data-style='glass'] .user-name {
  color: #ffffff;
}
html[data-style='glass'] .avatar {
  box-shadow: 0 4px 14px rgba(228, 184, 99, 0.35);
}
html[data-style='glass'] .theme-btn {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--ink-3);
  box-shadow:
    0 8px 24px rgba(3, 7, 18, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  transition:
    background-color var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out),
    color var(--dur-4) var(--ease-out);
}
html[data-style='glass'] .theme-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--accent-400);
  box-shadow:
    0 16px 40px rgba(3, 7, 18, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}
html[data-style='glass'] .theme-btn:active {
  box-shadow: inset 0 2px 8px rgba(2, 6, 16, 0.45);
}
/* 面板里的三段风格选项：未选中是玻璃薄片，选中是香槟金染色玻璃 */
html[data-style='glass'] .style-opt {
  background: rgba(255, 255, 255, 0.05);
  color: var(--ink-3);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition:
    background-color var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out),
    color var(--dur-4) var(--ease-out);
}
html[data-style='glass'] .style-opt:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}
html[data-style='glass'] .style-opt.on {
  background: rgba(228, 184, 99, 0.14);
  color: var(--accent-400);
  box-shadow: inset 0 0 0 1px rgba(228, 184, 99, 0.4);
}
html[data-style='glass'] .theme-label {
  color: var(--ink-2);
}
html[data-style='glass'] .theme-hint {
  color: var(--ink-3);
}
@media (prefers-reduced-motion: reduce) {
  html[data-style='glass'] .nav-item,
  html[data-style='glass'] .nav-item:hover,
  html[data-style='glass'] .nav-item:active,
  html[data-style='glass'] .btn-record:hover,
  html[data-style='glass'] .user-box,
  html[data-style='glass'] .theme-btn {
    transition: none;
    transform: none;
  }
}

/* ============================================================================
   主题四：俏皮野兽派 —— 顶栏与导航

   顶栏是一块白板压在页面顶上，靠 4px 黑边和底影划分边界。导航项平时是纯文字，
   悬停铺阳光黄，当前页才长出黑框 + 珊瑚硬影——整条顶栏只有主行动一枚倾斜的
   珊瑚方块，符合「同屏最多四种强调色」的克制。
   ============================================================================ */
html[data-style='playful'] .topbar {
  background: #fff;
  border-bottom: 4px solid #000;
  box-shadow: none;
}
html[data-style='playful'] .logo-badge {
  border: 4px solid #000;
  border-radius: 0;
  background: #ffe66d;
  color: #000;
  box-shadow: 4px 4px 0 #000;
}
html[data-style='playful'] .logo-name {
  color: #000;
  font-weight: 900;
  letter-spacing: -0.02em;
}
html[data-style='playful'] .logo-sub {
  color: #000;
  font-weight: 700;
}
/* 边框常驻（透明时仍占位），避免当前页切换时导航条高度跳动 */
html[data-style='playful'] .nav-item {
  border: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #000;
  font-weight: 700;
  box-shadow: none;
  transition:
    background-color var(--dur-2) ease,
    box-shadow var(--dur-3) var(--ease-out),
    transform var(--dur-3) var(--ease-out);
}
html[data-style='playful'] .nav-item:hover {
  background: #ffe66d;
  border-color: #000;
  color: #000;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #000;
}
html[data-style='playful'] .nav-item:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
html[data-style='playful'] .nav-item.on,
html[data-style='playful'] .nav-item.on:active {
  background: #fff;
  border-color: #000;
  color: #000;
  font-weight: 900;
  transform: none;
  box-shadow: 3px 3px 0 #ff6b6b;
}
/* 当前页的圆点指示灯不属于这套风格，边界已经由黑框说清楚了 */
html[data-style='playful'] .nav-item.on::after {
  display: none;
}
html[data-style='playful'] .date {
  color: #000;
  font-weight: 700;
}
/* 主行动：珊瑚方块、4px 黑边、6px 薄荷硬影，静置 -2 度 */
html[data-style='playful'] .btn-record {
  border: 4px solid #000;
  border-radius: 0;
  background: #ff6b6b;
  color: #fff;
  font-weight: 900;
  box-shadow: 6px 6px 0 #4ecdc4;
  transform: rotate(-2deg);
  transition:
    transform var(--dur-3) var(--ease-out),
    box-shadow var(--dur-3) var(--ease-out),
    background-color var(--dur-2) ease;
}
html[data-style='playful'] .btn-record:hover {
  background: #ff6b6b;
  color: #fff;
  transform: translate(-1px, -4px) rotate(3deg);
  box-shadow: 8px 8px 0 #ffe66d;
}
html[data-style='playful'] .btn-record:active {
  background: #f04f4f;
  color: #fff;
  transform: translate(6px, 6px) scale(0.95) rotate(0deg);
  box-shadow: none;
}
html[data-style='playful'] .user-box {
  background: #fff;
  border: 3px solid #000;
  border-radius: 0;
  box-shadow: 4px 4px 0 #000;
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    transform var(--dur-3) var(--ease-out);
}
html[data-style='playful'] .user-box:hover {
  transform: translate(-1px, -2px);
  box-shadow: 6px 6px 0 #000;
}
html[data-style='playful'] .user-name {
  color: #000;
  font-weight: 700;
}
html[data-style='playful'] .avatar {
  border: 3px solid #000;
  color: #000 !important;
  background: #ffe66d !important;
  font-weight: 900;
  box-shadow: none;
}
html[data-style='playful'] .theme-btn {
  border: 3px solid #000;
  border-radius: 0;
  background: #fff;
  color: #000;
  box-shadow: 3px 3px 0 #000;
  transition:
    transform var(--dur-3) var(--ease-out),
    box-shadow var(--dur-3) var(--ease-out),
    background-color var(--dur-2) ease;
}
html[data-style='playful'] .theme-btn:hover {
  background: #ffe66d;
  color: #000;
  transform: translate(-1px, -2px);
  box-shadow: 5px 5px 0 #000;
}
html[data-style='playful'] .theme-btn:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}
/* 面板里的风格选项：黑框小方块，选中是珊瑚实心 */
/* 四枚主题块排成 2×2：野兽派每块都要带黑框，挤成一行会掉一颗到第二行 */
html[data-style='playful'] .style-opts {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  justify-content: stretch;
  gap: 6px;
}
html[data-style='playful'] .style-opt {
  text-align: center;
  border: 2px solid #000;
  border-radius: 0;
  background: #fff;
  color: #000;
  font-weight: 700;
  box-shadow: 2px 2px 0 #000;
  transition:
    transform var(--dur-3) var(--ease-out),
    box-shadow var(--dur-3) var(--ease-out),
    background-color var(--dur-2) ease;
}
html[data-style='playful'] .style-opt:hover {
  background: #ffe66d;
  color: #000;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #000;
}
html[data-style='playful'] .style-opt.on {
  background: #ff6b6b;
  color: #fff;
  font-weight: 900;
  box-shadow: 3px 3px 0 #000;
}
html[data-style='playful'] .theme-label {
  color: #000;
  font-weight: 700;
}
html[data-style='playful'] .theme-hint {
  color: #000;
  font-weight: 600;
}
@media (prefers-reduced-motion: reduce) {
  html[data-style='playful'] .nav-item,
  html[data-style='playful'] .nav-item:hover,
  html[data-style='playful'] .nav-item:active,
  html[data-style='playful'] .user-box:hover,
  html[data-style='playful'] .theme-btn:hover,
  html[data-style='playful'] .style-opt:hover,
  html[data-style='playful'] .btn-record,
  html[data-style='playful'] .btn-record:hover,
  html[data-style='playful'] .btn-record:active {
    transition: none;
    transform: none;
  }
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'

const router = useRouter()
let offNav: (() => void) | null = null
let offBanner: (() => void) | null = null

// 托盘「今日活动」和系统通知点击都会走这里：把窗口带到前台并跳到记录页，
// 只预选活动，不自动开始计时（用户确认后才开）。
onMounted(() => {
  offNav = window.lc?.onNavigate((p) => {
    const query: Record<string, string> = {}
    if (p.sourceId) query.sourceId = String(p.sourceId)
    if (p.sourceName) query.sourceName = p.sourceName
    void router.push({ path: p.path || '/', query })
  })

  // 每次活动提醒都会投一条应用内横幅：系统通知点开会重新拉起应用（拿不到点击回调），
  // 真正能「点一下就跳到记录页并预选活动」的是这条横幅。它不自动消失，
  // 窗口收起时也能等你下次打开再点。
  offBanner = window.lc?.onActivityBanner((b) => {
    const minutes = Math.max(0, b.minutes)
    const n = ElNotification({
      title: b.kind === 'start' ? '活动开始了' : '活动即将开始',
      message: `${b.sourceName} ${
        b.kind === 'start' ? '已经开始' : minutes <= 0 ? '即将开始' : `${minutes} 分钟后开始`
      } · 点这里去记录`,
      type: 'warning',
      duration: 0,
      onClick: () => {
        n.close()
        void router.push({
          path: '/record',
          query: { sourceId: String(b.sourceId), sourceName: b.sourceName }
        })
      }
    })
  })
})

onBeforeUnmount(() => {
  offNav?.()
  offBanner?.()
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
</template>

<style>
/* ============================================================================
   设计 token —— 采用 BoardUI 的两层结构（BoardUI 是 React + Tailwind 的设计
   系统，组件源码装不进 Vue，这里落地的是它的设计语言）：

     第一层  原始色阶（neutral / accent 两条 ramp），只有 token 互相引用
     第二层  语义 token（surface / ink / line / status），组件只用这一层
     暗色    只重新绑定第二层，组件里不写任何 dark: 或第二套颜色

   同时保留项目原有的变量名（--bg-card、--text-primary …）作为语义层的别名，
   十个视图不必逐个改写。品牌色沿用鼠尾草绿与暖中性，属于 BoardUI 允许的
   rebrand：把 accent ramp 与 neutral ramp 换成自己的色即可。
   ============================================================================ */

:root {
  /* ===== 第一层：原始色阶（暖中性） ===== */
  --n-0: #ffffff;
  --n-50: #fdfbf8;
  --n-100: #f7f2ea;
  --n-200: #efe7db;
  --n-300: #e3d8c8;
  --n-400: #cbbdaa;
  --n-500: #a89a88;
  --n-600: #877a69;
  --n-700: #6b5d50;
  --n-800: #4a3f36;
  --n-900: #3a2e26;
  --n-950: #241c16;

  /* ===== 第一层：品牌色阶（鼠尾草绿，accent-500 是品牌主色） ===== */
  --a-50: #f3f6ef;
  --a-100: #e7ecdf;
  --a-200: #d2dbc5;
  --a-300: #b6c4a4;
  --a-400: #a3b28f;
  --a-500: #8b9d77;
  --a-600: #71835f;
  --a-700: #5b6b4c;
  --a-800: #47543c;
  --a-900: #35402d;
  --a-950: #1f2619;

  /* ===== 第二层：语义 token ===== */
  /* 表面：页面底 → 卡片 → 托盘 → 下沉 */
  --surface-page: var(--n-100);
  --surface-card: var(--n-0);
  --surface-tray: var(--n-50);
  --surface-sunken: var(--n-200);
  /* 文字四档：主 / 次 / 三级 / 占位 */
  --ink-1: var(--n-900);
  --ink-2: var(--n-700);
  --ink-3: var(--n-600);
  --ink-4: var(--n-500);
  /* 线：控件描边 / 分隔线 / 焦点环 */
  --line-control: var(--n-300);
  --line-separator: var(--n-200);
  --line-focus: var(--a-500);

  /* 阴影：BoardUI 的卡片靠描边分层，阴影只做极轻的一层 */
  --shadow-card: 0 1px 2px rgba(36, 28, 22, 0.04);
  --shadow-card-hover: 0 10px 28px rgba(36, 28, 22, 0.1), 0 0 0 1px rgb(var(--accent-rgb) / 0.16);
  --shadow-float: 0 16px 48px rgba(36, 28, 22, 0.18);
  --scrim: rgba(36, 28, 22, 0.55);

  /* 语义色 */
  --positive: #5f7d4a;
  --negative: #a8563f;
  --info: #6b8ca8;
  --warning: #c08a3e;

  /* ===== 字号阶：一档一个复合样式（size / line-height / weight） ===== */
  --text-title-1: 600 24px / 32px var(--sans-font);
  --text-title-2: 600 20px / 28px var(--sans-font);
  --text-title-3: 600 18px / 26px var(--sans-font);
  --text-headline: 600 16px / 24px var(--sans-font);
  --text-body: 400 14px / 20px var(--sans-font);
  --text-body-2: 400 13px / 18px var(--sans-font);
  --text-caption-1: 400 12px / 16px var(--sans-font);
  --text-caption-2: 400 11px / 14px var(--sans-font);
  --tracking-tight: -0.02em;
  --tracking-normal: -0.01em;

  /* ===== 形状：卡片 rounded-3xl，控件 12px，胶囊 ===== */
  --radius-card: 24px;
  --radius-control: 12px;
  --radius-pill: 999px;

  /* ===== 动效：BoardUI 的时长与缓动 ===== */
  --dur-1: 100ms;
  --dur-2: 150ms;
  --dur-3: 200ms;
  --dur-4: 300ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-modal: cubic-bezier(0.32, 0.72, 0, 1);

  /* ===== 品牌：主色 + 主色底上的前景色 ===== */
  --accent-rgb: 139, 157, 119;
  --accent-400: var(--a-400);
  --accent-500: var(--a-500);
  --accent-600: var(--a-600);
  --accent-glow: rgb(var(--accent-rgb) / 0.16);
  --on-accent: #1f1a10;
  --btn-accent-bg: var(--a-500);

  /* ===== 兼容别名：视图里的老变量名 → 语义层 ===== */
  --bg-base: var(--surface-page);
  --bg-panel: var(--surface-tray);
  --bg-card: var(--surface-card);
  --bg-raised: var(--surface-sunken);
  --bg-input: var(--surface-card);
  /* 卡片描边走控件线一档：BoardUI 的卡片用 border-button-default，比分隔线明显 */
  --border: var(--line-control);
  --border-strong: var(--n-400);
  --text-primary: var(--ink-1);
  --text-secondary: var(--ink-2);
  --text-muted: var(--ink-3);
  --card-shadow: var(--shadow-card);
  --card-shadow-hover: var(--shadow-card-hover);
  --bg-grid: rgba(92, 64, 51, 0.045);
  --bg-accent-glow: 0.05;
  --bg-info-glow: 0.05;
  --scroll-thumb: var(--n-300);
  --scroll-thumb-hover: var(--n-400);

  /* ===== 字体 ===== */
  --sans-font: 'PingFang SC', 'Microsoft YaHei UI', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif;
  --serif-font: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', Georgia, serif;
  --num-font: 'Bahnschrift', 'DIN Alternate', 'Segoe UI', 'Microsoft YaHei UI', sans-serif;
}

/* ===== 暖色暗色档：只重绑语义层 ===== */
html.dark {
  --surface-page: #17130f;
  --surface-card: #201b16;
  --surface-tray: #262019;
  --surface-sunken: #2e271f;

  --ink-1: #f3ece1;
  --ink-2: #c0b3a3;
  --ink-3: #a39280;
  --ink-4: #7d7062;

  --line-control: #3a3129;
  --line-separator: #2b241d;

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 10px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgb(var(--accent-rgb) / 0.14);
  --shadow-float: 0 16px 48px rgba(0, 0, 0, 0.55);
  --scrim: rgba(0, 0, 0, 0.68);

  --bg-grid: rgba(243, 236, 225, 0.02);
  --bg-accent-glow: 0.07;
  --bg-info-glow: 0.06;
  --scroll-thumb: #3a3129;
  --scroll-thumb-hover: #4b3f34;

  --accent-glow: rgb(var(--accent-rgb) / 0.24);
}

/* ===== 主色主题：换 ramp 即可全站跟随 ===== */
html[data-accent='terracotta'] {
  --accent-rgb: 168, 86, 63;
  --accent-400: #c07a5e;
  --accent-500: #a8563f;
  --accent-600: #8a4432;
  --on-accent: #fff;
}
html[data-accent='olive'] {
  --accent-rgb: 122, 138, 90;
  --accent-400: #93a273;
  --accent-500: #7a8a5a;
  --accent-600: #62704a;
  --on-accent: #14120a;
}
html[data-accent='amber'] {
  --accent-rgb: 200, 150, 64;
  --accent-400: #dcae63;
  --accent-500: #c89640;
  --accent-600: #a97a2c;
  --on-accent: #1f1a10;
}

/* 物品价格分级颜色：暖色档，避开高饱和蓝紫绿红 */
.tier-w {
  color: #6f8fa8;
}
.tier-10w {
  color: #6f8f57;
}
.tier-100w {
  color: #a8563f;
}
.tier-1000w {
  color: #7a5c8a;
}
.tier-w .el-input__inner {
  color: #6f8fa8 !important;
}
.tier-10w .el-input__inner {
  color: #6f8f57 !important;
}
.tier-100w .el-input__inner {
  color: #a8563f !important;
}
.tier-1000w .el-input__inner {
  color: #7a5c8a !important;
}

/* ===== Element Plus 亮色映射：全部指向语义层 ===== */
:root:not(.dark) {
  --el-color-primary: var(--accent-500);
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 75%, var(--surface-card));
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 60%, var(--surface-card));
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 45%, var(--surface-card));
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 35%, var(--surface-card));
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 15%, var(--surface-card));
  --el-color-primary-dark-2: color-mix(in srgb, var(--accent-500) 80%, var(--ink-1));

  --el-bg-color: var(--surface-card);
  --el-bg-color-page: var(--surface-page);
  --el-bg-color-overlay: var(--surface-card);
  --el-fill-color-blank: var(--surface-card);
  --el-fill-color: var(--surface-sunken);
  --el-fill-color-light: var(--surface-tray);
  --el-fill-color-lighter: var(--surface-tray);
  --el-fill-color-dark: var(--line-control);
  --el-fill-color-darker: var(--n-400);

  --el-border-color: var(--line-separator);
  --el-border-color-light: var(--line-separator);
  --el-border-color-lighter: var(--line-separator);
  --el-border-color-extra-light: var(--line-separator);
  --el-border-color-dark: var(--line-control);
  --el-border-color-hover: var(--accent-500);

  --el-text-color-primary: var(--ink-1);
  --el-text-color-regular: var(--ink-2);
  --el-text-color-secondary: var(--ink-3);
  --el-text-color-placeholder: var(--ink-4);
  --el-text-color-disabled: var(--n-400);

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 8px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: rgba(36, 28, 22, 0.38);
  --el-box-shadow: var(--shadow-float);
  --el-box-shadow-light: var(--shadow-float);
  --el-box-shadow-lighter: var(--shadow-card);

  /* 表格：BoardUI 的表格是细横线 + 悬浮托盘色，表头只做小字标签 */
  --el-table-border-color: var(--line-separator);
  --el-table-border: 1px solid var(--line-separator);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-header-text-color: var(--ink-3);
  --el-table-text-color: var(--ink-1);
  --el-table-row-hover-bg-color: var(--surface-tray);
}

/* ===== Element Plus 暗色映射 ===== */
html.dark {
  --el-color-primary: var(--accent-500);
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 75%, var(--surface-card));
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 60%, var(--surface-card));
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 45%, var(--surface-card));
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 35%, var(--surface-card));
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 15%, var(--surface-card));
  --el-color-primary-dark-2: color-mix(in srgb, var(--accent-500) 80%, #000);

  --el-bg-color: var(--surface-card);
  --el-bg-color-page: var(--surface-page);
  --el-bg-color-overlay: var(--surface-tray);
  --el-fill-color-blank: var(--surface-card);
  --el-fill-color: var(--surface-sunken);
  --el-fill-color-light: var(--surface-tray);
  --el-fill-color-lighter: var(--surface-card);
  --el-fill-color-dark: var(--line-control);
  --el-fill-color-darker: var(--n-600);

  --el-border-color: var(--line-separator);
  --el-border-color-light: var(--line-separator);
  --el-border-color-lighter: var(--line-control);
  --el-border-color-extra-light: var(--line-control);
  --el-border-color-dark: var(--line-control);
  --el-border-color-hover: var(--accent-400);

  --el-text-color-primary: var(--ink-1);
  --el-text-color-regular: var(--ink-2);
  --el-text-color-secondary: var(--ink-3);
  --el-text-color-placeholder: var(--ink-4);
  --el-text-color-disabled: var(--n-600);

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 8px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: rgba(0, 0, 0, 0.66);
  --el-box-shadow: var(--shadow-float);
  --el-box-shadow-light: var(--shadow-float);
  --el-box-shadow-lighter: var(--shadow-card);

  --el-table-border-color: var(--line-separator);
  --el-table-border: 1px solid var(--line-separator);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-header-text-color: var(--ink-3);
  --el-table-text-color: var(--ink-1);
  --el-table-row-hover-bg-color: var(--surface-tray);
}

/* 表头：小字标签 + 字重，而不是加粗正文 */
.el-table th.el-table__cell > .cell {
  font: var(--text-caption-1);
  font-weight: 600;
  letter-spacing: 0.02em;
}

/*
 * 主色按钮：hover 提亮一档、按下压暗一档（BoardUI 的按压反馈是颜色步进，
 * 不是缩放），文字统一走 --on-accent。
 */
.el-button--primary {
  --el-button-text-color: var(--on-accent);
  --el-button-hover-text-color: var(--on-accent);
  --el-button-active-text-color: var(--on-accent);
  --el-button-hover-bg-color: var(--accent-500);
  --el-button-active-bg-color: var(--accent-600);
  font-weight: 600;
  transition: filter var(--dur-2) ease, background-color var(--dur-2) ease;
}
.el-button--primary:not(.is-disabled):hover {
  filter: brightness(1.06);
}
.el-button--primary:not(.is-disabled):active {
  filter: brightness(0.95);
}

/* 控件圆角：BoardUI 的按钮/输入是 12px 圆角，胶囊只留给标签 */
.el-button {
  border-radius: var(--radius-control);
  transition:
    background-color var(--dur-2) ease,
    border-color var(--dur-2) ease,
    color var(--dur-2) ease;
}
.el-tag {
  --el-tag-border-radius: var(--radius-pill);
}

/*
 * EP 的开关内联提示文字（亮/暗）两态都写死白字，关闭态白字压在浅色滑轨上看不见，
 * 只有关闭态需要改回深色。
 */
.el-switch__core .el-switch__inner-wrapper {
  color: var(--ink-2);
}
.el-switch.is-checked .el-switch__core .el-switch__inner-wrapper {
  color: var(--on-accent);
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

/*
 * BoardUI 的表面是干净的平面：页面用 --surface-page，卡片用 --surface-card + 细描边，
 * 不叠纹理、不叠渐变。原来的纸张噪点在新的分层里只会让文字发毛。
 */
body {
  color: var(--ink-1);
  font: var(--text-body);
  font-family: var(--sans-font);
  background: var(--surface-page);
  -webkit-font-smoothing: antialiased;
}

/* ===== 字号阶：标题走 title 三档，不再用衬线 ===== */
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--sans-font);
  color: var(--ink-1);
  letter-spacing: var(--tracking-tight);
}
h1 {
  font: var(--text-title-1);
  font-family: var(--sans-font);
  letter-spacing: var(--tracking-tight);
}
h2 {
  font: var(--text-title-2);
  font-family: var(--sans-font);
  letter-spacing: var(--tracking-tight);
}
h3,
h4,
h5,
h6 {
  font: var(--text-title-3);
  font-family: var(--sans-font);
  letter-spacing: var(--tracking-tight);
}

/* 卡片标题：BoardUI 的卡片标题是 headline 一档（16px semibold） */
.card-title {
  font: var(--text-headline);
  font-family: var(--sans-font);
  letter-spacing: var(--tracking-normal);
  color: var(--ink-1);
}

/* 键盘焦点：BoardUI 用主色描一圈 focus ring */
:where(button, [role='button'], a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--line-focus);
  outline-offset: 2px;
}

/* 细滚动条 */
::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb);
  border-radius: var(--radius-pill);
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scroll-thumb-hover);
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* 金额等数字统一等宽对齐 */
.num {
  font-family: var(--num-font);
  font-variant-numeric: tabular-nums;
}

/*
 * 路由过渡：BoardUI 的入场是「淡入 + 轻微缩放 + 2px 模糊」，不是从远处滑入；
 * 退场比入场快。
 */
.fade-enter-active {
  transition:
    opacity var(--dur-3) var(--ease-out),
    transform var(--dur-3) var(--ease-out),
    filter var(--dur-3) var(--ease-out);
}
.fade-leave-active {
  transition:
    opacity var(--dur-2) ease-in,
    transform var(--dur-2) ease-in,
    filter var(--dur-2) ease-in;
}
.fade-enter-from {
  opacity: 0;
  transform: scale(0.99);
  filter: blur(2px);
}
.fade-leave-to {
  opacity: 0;
  transform: scale(0.995);
  filter: blur(2px);
}

/* 系统设置里关掉动效时，路由切换与入场动画一并停掉 */
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>

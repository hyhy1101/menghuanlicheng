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
   设计 token —— Natural Organic（自然有机风），与官网（apps/portal）同一套语言。

   官网用的是 Tailwind 字面值（bg-[#faf6f1] / bg-[#8b9d77] / bg-stone-800…），
   客户端这边继续用 CSS 变量 —— 它本来就有完整的 token 体系，改值即可全站生效，
   不必把每个组件改写成工具类。变量值刻意与官网取同一组色：
     米色背景 #faf6f1 / 暖棕文字 #3a2e26 / 鼠尾草绿 #8b9d77 / 暖棕黄 #d4a373
   ============================================================================ */

/* ===== 亮色基础变量（默认，也是 Natural Organic 的主场） ===== */
:root {
  --bg-base: #faf6f1;
  /* 侧边栏/面板比页面略深一档，靠明度分层而不是靠描边 */
  --bg-panel: #f3ece1;
  --bg-card: #ffffff;
  --bg-raised: #efe7db;
  --bg-input: #ffffff;
  --border: #e7ddcf;
  --border-strong: #d3c5b2;
  --text-primary: #3a2e26;
  --text-secondary: #6b5d50;
  --text-muted: #a3927d;
  --card-shadow: 0 4px 18px rgba(92, 64, 51, 0.07);
  --card-shadow-hover:
    0 10px 30px rgba(92, 64, 51, 0.12), 0 0 0 1px rgb(var(--accent-rgb) / 0.18);
  /* 弹层遮罩与悬浮阴影：暖色而不是纯黑，纯黑在米色底上会显脏 */
  --scrim: rgba(58, 46, 38, 0.55);
  --shadow-float: 0 18px 60px rgba(92, 64, 51, 0.28);
  --bg-grid: rgba(92, 64, 51, 0.045);
  --bg-accent-glow: 0.05;
  --bg-info-glow: 0.05;
  --scroll-thumb: #ddd1c0;
  --scroll-thumb-hover: #cdbfab;

  /* 默认主色：鼠尾草绿 */
  --accent-rgb: 139, 157, 119;
  --accent-400: #a3b28f;
  --accent-500: #8b9d77;
  --accent-600: #71835f;
  --accent-glow: rgb(var(--accent-rgb) / 0.16);
  /*
   * 主题色底上的前景色（文字 / 图标 / 圆点）。
   *
   * 与旧版的关键差别：旧版四个主题都是浅色，却一律用白字，注释里也承认
   * 对比度只有约 1.9:1、远低于 WCAG AA。自然有机风的四个主色同样是中浅调，
   * 所以这里改用深色前景，对比度约 5~6:1，顺带修掉了那个可读性问题。
   * 四个主题色各自在自己的 data-accent 块里重新给出该值。
   */
  --on-accent: #1f1a10;
  /* 主色实心按钮的底色：与官网一致用纯色，不再叠 180° 渐变 */
  --btn-accent-bg: var(--accent-500);

  /* 语义色：从冷色系改成暖色系，保证与主色同处大地色家族 */
  --positive: #5f7d4a;
  --negative: #a8563f;
  --info: #6b8ca8;
  --warning: #c08a3e;

  /* 字体 */
  --sans-font: 'PingFang SC', 'Microsoft YaHei UI', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif;
  --serif-font: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', Georgia, serif;
  /* 金额等数字用等宽，保证对齐；不含 Roboto（风格包列为过度使用字体） */
  --num-font: 'Bahnschrift', 'DIN Alternate', 'Segoe UI', 'Microsoft YaHei UI', sans-serif;

  /* 圆角：卡片走有机大圆角，控件走小圆角，呼应官网的 rounded-[2rem] + rounded-full */
  --radius-card: 20px;
  --radius-control: 10px;
  --radius-pill: 999px;
}

/* ===== 暖色暗色档（不是原来的冷黑） ===== */
html.dark {
  --bg-base: #1c1815;
  --bg-panel: #221d19;
  --bg-card: #282219;
  --bg-raised: #332b23;
  --bg-input: #201b16;
  --border: #3a3129;
  --border-strong: #4b3f34;
  --text-primary: #f3ece1;
  --text-secondary: #c0b3a3;
  --text-muted: #8a7d6e;
  --card-shadow: 0 4px 18px rgba(0, 0, 0, 0.34);
  --card-shadow-hover: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgb(var(--accent-rgb) / 0.12);
  --scrim: rgba(0, 0, 0, 0.68);
  --shadow-float: 0 18px 60px rgba(0, 0, 0, 0.55);
  --bg-grid: rgba(243, 236, 225, 0.02);
  --bg-accent-glow: 0.07;
  --bg-info-glow: 0.06;
  --scroll-thumb: #3a3129;
  --scroll-thumb-hover: #4b3f34;

  --accent-glow: rgb(var(--accent-rgb) / 0.24);
}

/* ===== 主色调：四个大地色，去掉了原来的冰蓝与紫罗兰 ===== */
html[data-accent='terracotta'] {
  --accent-rgb: 168, 86, 63;
  --accent-400: #c07a5e;
  --accent-500: #a8563f;
  --accent-600: #8a4432;
  /* 赤陶本身足够深，白字对比度约 5.1:1 */
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

/* 物品价格分级颜色：改成暖色档，避开原来的高饱和蓝紫绿红 */
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

/* ===== Element Plus 亮色主色覆盖 ===== */
:root:not(.dark) {
  --el-color-primary: var(--accent-500);
  /* 与暖米色混合，而不是纯白，避免出现一层冷灰 */
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 75%, #faf6f1);
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 60%, #faf6f1);
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 45%, #faf6f1);
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 35%, #faf6f1);
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 15%, #faf6f1);
  --el-color-primary-dark-2: color-mix(in srgb, var(--accent-500) 80%, #3a2e26);

  --el-bg-color: #ffffff;
  --el-bg-color-page: var(--bg-base);
  --el-bg-color-overlay: #ffffff;
  --el-fill-color-blank: #ffffff;
  --el-fill-color: var(--bg-raised);
  --el-fill-color-light: var(--bg-panel);
  --el-fill-color-lighter: var(--bg-card);
  --el-fill-color-dark: var(--border);
  --el-fill-color-darker: var(--border-strong);

  --el-border-color: var(--border);
  --el-border-color-light: var(--border);
  --el-border-color-lighter: var(--border);
  --el-border-color-extra-light: var(--border);
  --el-border-color-dark: var(--border-strong);
  --el-border-color-hover: var(--accent-500);

  --el-text-color-primary: var(--text-primary);
  --el-text-color-regular: var(--text-secondary);
  --el-text-color-secondary: var(--text-secondary);
  --el-text-color-placeholder: var(--text-muted);
  --el-text-color-disabled: #bcae9b;

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 8px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: rgba(58, 46, 38, 0.38);
  --el-box-shadow: 0 8px 30px rgba(92, 64, 51, 0.16);
  --el-box-shadow-light: 0 4px 18px rgba(92, 64, 51, 0.1);
  --el-box-shadow-lighter: 0 2px 10px rgba(92, 64, 51, 0.07);
}

/* ===== Element Plus 暗色主色覆盖 ===== */
html.dark {
  --el-color-primary: var(--accent-500);
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 75%, #f3ece1);
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 60%, #f3ece1);
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 45%, #221d19);
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 35%, #221d19);
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 15%, #221d19);
  --el-color-primary-dark-2: color-mix(in srgb, var(--accent-500) 80%, #000);

  --el-bg-color: #282219;
  --el-bg-color-page: #1c1815;
  --el-bg-color-overlay: #332b23;
  --el-fill-color-blank: #201b16;
  --el-fill-color: #332b23;
  --el-fill-color-light: #2d2620;
  --el-fill-color-lighter: #282219;
  --el-fill-color-dark: #3a3129;
  --el-fill-color-darker: #4b3f34;

  --el-border-color: #3a3129;
  --el-border-color-light: #3a3129;
  --el-border-color-lighter: #4b3f34;
  --el-border-color-extra-light: #4b3f34;
  --el-border-color-dark: #4b3f34;
  --el-border-color-hover: var(--accent-400);

  --el-text-color-primary: #f3ece1;
  --el-text-color-regular: #c0b3a3;
  --el-text-color-secondary: #c0b3a3;
  --el-text-color-placeholder: #8a7d6e;
  --el-text-color-disabled: #665a4c;

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 8px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: rgba(0, 0, 0, 0.66);
  --el-box-shadow: 0 8px 30px rgba(0, 0, 0, 0.52);
  --el-box-shadow-light: 0 4px 18px rgba(0, 0, 0, 0.34);
  --el-box-shadow-lighter: 0 2px 10px rgba(0, 0, 0, 0.26);
}

/* 主色按钮：文字走 --on-accent，这里只固定 hover / active 两档背景 */
.el-button--primary {
  --el-button-text-color: var(--on-accent);
  --el-button-hover-text-color: var(--on-accent);
  --el-button-active-text-color: var(--on-accent);
  --el-button-hover-bg-color: var(--accent-400);
  --el-button-active-bg-color: var(--accent-600);
  font-weight: 600;
}

/* 胶囊圆角，呼应官网的 rounded-full；标签同理 */
.el-button {
  border-radius: var(--radius-pill);
}
.el-tag {
  --el-tag-border-radius: var(--radius-pill);
}

/*
 * Element Plus 默认就把主色底上的文字写成 --el-color-white，与 --on-accent 一致，
 * 所以分页当前页、日历选中日这类组件不需要覆盖。
 * 唯一例外是开关的内联提示文字（亮/暗）：EP 两态都写死白字，而关闭态的白字
 * 压在浅色滑轨上完全看不见，因此只有关闭态需要改回深色。
 */
.el-switch__core .el-switch__inner-wrapper {
  color: var(--text-secondary);
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

body {
  color: var(--text-primary);
  font-family: var(--sans-font);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  /* 纯色底，不再叠径向渐变 —— 自然有机风不用渐变 */
  background: var(--bg-base);
}

/*
 * 纸张纹理：与官网 paper-grain 同一张 SVG 噪点。
 * 原来是 34px 的科技感网格，与这套风格冲突，换掉。
 */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.45;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23g)' opacity='0.28'/%3E%3C/svg%3E");
}

/* 暗色下 multiply 会把画面压得更闷，改成轻微叠加 */
html.dark body::before {
  opacity: 0.16;
  mix-blend-mode: soft-light;
}

/* ===== 字体：标题走衬线，正文走暖调无衬线 ===== */
h1,
h2,
h3,
h4,
h5,
h6,
.card-title {
  font-family: var(--serif-font);
  letter-spacing: -0.01em;
  font-weight: 700;
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

/* 路由过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

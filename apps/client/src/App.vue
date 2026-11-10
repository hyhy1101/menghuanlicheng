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
   新拟物（Neumorphism）令牌层

   整套界面只有一束固定的光：光源在左上，所有元素都是左上白高光 + 右下冷灰暗影。

     原始层   --base 页面与所有元素的共同底色；--shade 右下暗影；--glow 左上高光
     语义层   surface / ink / line / status 仅引用原始层
     光影层   --elev-raised（凸起）与 --elev-inset（凹陷）两对，凸起翻转即凹陷

   规则：
     · 元素与背景同色，层级只由阴影表达，不用描边、不用实色填充换色
     · 凸起用外阴影对，凹陷用 inset 对，不混用
     · 悬停时阴影模糊减半（模拟手靠近遮光），按下翻成 inset 并归零位移
     · 字重最高 600，让材质当主角

   暗色不在规范允许范围内，但产品保留了明暗开关，这里沿用同一束光的反向取值：
   底色压暗、暗影更深、高光降到浅灰白，保持「左上亮、右下暗」的同一方向。
   ============================================================================ */

:root {
  /* ===== 原始层：新拟物三色 ===== */
  --base: #e0e5ec;
  --shade: #b8bcc2;
  --glow: #ffffff;
  /* 由三色派生的两个辅助色：略亮的悬停面、略暗的凹槽底 */
  --tint: #e8edf3;
  --sunken: #dce2ea;

  /* 文字：内容层才用深色，界面层用中灰 */
  --n-0: #ffffff;
  --n-50: #f2f5f9;
  --n-100: var(--base);
  --n-200: var(--sunken);
  --n-300: #cdd4dd;
  --n-400: var(--shade);
  --n-500: #8d97a4;
  --n-600: #78828f;
  --n-700: #5b6573;
  --n-800: #4a5260;
  --n-900: #3d4451;
  --n-950: #262b33;

  /* 品牌色阶：紫罗兰（全系统唯一压在基底上的饱和色） */
  --a-50: #f2f0ff;
  --a-100: #e6e3ff;
  --a-200: #d0caff;
  --a-300: #b1a6ff;
  --a-400: #8e80fd;
  --a-500: #6d5dfc;
  --a-600: #5a49e8;
  --a-700: #493bc4;
  --a-800: #3a2f9c;
  --a-900: #2b2474;
  --a-950: #191443;

  /* ===== 语义层 ===== */
  /* 表面：新拟物里页面与卡片同色，温区（托盘）只略亮一档用于悬停/行 */
  --surface-page: var(--base);
  --surface-card: var(--base);
  --surface-tray: var(--tint);
  --surface-sunken: var(--sunken);

  --ink-1: var(--n-900);
  --ink-2: var(--n-700);
  --ink-3: var(--n-600);
  --ink-4: #949daa;

  /* 线：只用在表格行与分隔沟，不用于卡片描边 */
  --line-control: var(--n-300);
  --line-separator: #d2d8e0;
  --line-focus: var(--a-500);

  /* ===== 光影层：两对阴影 ===== */
  /* 卡片级（为数据密度把规范里的 8/16 缩到 6/14，避免相邻卡片阴影互相污染） */
  --elev-raised: 6px 6px 14px var(--shade), -6px -6px 14px var(--glow);
  --elev-raised-lg: 8px 8px 16px var(--shade), -8px -8px 16px var(--glow);
  --elev-raised-sm: 4px 4px 9px var(--shade), -4px -4px 9px var(--glow);
  --elev-raised-xs: 2px 2px 5px var(--shade), -2px -2px 5px var(--glow);
  --elev-hover: 4px 4px 8px var(--shade), -4px -4px 8px var(--glow);
  --elev-inset: inset 4px 4px 8px var(--shade), inset -4px -4px 8px var(--glow);
  --elev-inset-sm: inset 2px 2px 5px var(--shade), inset -2px -2px 5px var(--glow);
  --elev-well: inset 6px 6px 12px var(--shade), inset -6px -6px 12px var(--glow);
  --elev-pressed: inset 4px 4px 8px var(--shade), inset -4px -4px 8px var(--glow);
  /* 浮层：对话框 / 下拉 / 气泡 */
  --elev-float: 12px 12px 28px var(--shade), -10px -10px 24px var(--glow);
  --scrim: rgba(61, 68, 81, 0.24);

  /* 兼容别名：视图里的老变量名 */
  --shadow-card: var(--elev-raised);
  --shadow-card-hover: var(--elev-hover);
  --shadow-float: var(--elev-float);

  /* ===== 状态色：文字用深一档保证对比，填充/图表用饱和色 ===== */
  --positive: #0e7368;
  --positive-rgb: 78, 205, 196; /* 薄荷，用于底色/图表填充 */
  --negative: #c0433f;
  --negative-rgb: 255, 107, 107; /* 珊瑚，用于底色/图表填充 */
  --warning: #a86a10;
  --warning-rgb: 232, 163, 61;
  --info: #3f6fb5;
  --info-rgb: 91, 141, 239;

  /* ===== 字号阶：一档一个复合样式 ===== */
  --text-display: 600 36px / 1.15 var(--sans-font);
  --text-heading: 600 28px / 1.3 var(--sans-font);
  --text-subheading: 500 20px / 1.4 var(--sans-font);
  --text-title-1: 600 28px / 36px var(--sans-font);
  --text-title-2: 600 20px / 28px var(--sans-font);
  --text-title-3: 500 18px / 26px var(--sans-font);
  --text-headline: 500 16px / 24px var(--sans-font);
  --text-body-lg: 400 16px / 1.6 var(--sans-font);
  --text-body: 400 14px / 1.6 var(--sans-font);
  --text-body-2: 400 13px / 1.55 var(--sans-font);
  --text-caption-1: 400 12px / 1.4 var(--sans-font);
  --text-caption-2: 400 11px / 1.4 var(--sans-font);
  --text-label: 500 12px / 1.4 var(--sans-font);
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-label: 0.08em;

  /* ===== 形状：卡片 24、按钮与输入 16、胶囊 ===== */
  --radius-card: 24px;
  --radius-control: 16px;
  --radius-pill: 999px;

  /* ===== 动效：悬停 200ms ease-out，按下瞬时，退场更快 ===== */
  --dur-1: 100ms;
  --dur-2: 150ms;
  --dur-3: 200ms;
  --dur-4: 300ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-modal: cubic-bezier(0.32, 0.72, 0, 1);

  /* ===== 品牌 ===== */
  /* 空格分隔（不是逗号）：下面的用法都是 rgb(var(--accent-rgb) / 0.2)，
     写成逗号会拼出 rgb(109, 93, 252 / 0.2) 这种非法值，整条声明被丢弃。 */
  --accent-rgb: 109 93 252;
  --accent-400: var(--a-400);
  --accent-500: var(--a-500);
  --accent-600: var(--a-600);
  /* 强调色作为正文时的可读取值：浅色底压深，深色底提亮，随主题色自动变 */
  --ink-accent: color-mix(in srgb, var(--accent-500) 84%, #262b33);
  --accent-glow: rgb(var(--accent-rgb) / 0.18);
  --on-accent: #ffffff;
  --btn-accent-bg: var(--a-500);

  /* ===== 兼容别名 ===== */
  --bg-base: var(--surface-page);
  --bg-panel: var(--surface-tray);
  --bg-card: var(--surface-card);
  --bg-raised: var(--surface-sunken);
  --bg-input: var(--surface-card);
  --border: var(--line-control);
  --border-strong: var(--n-400);
  --text-primary: var(--ink-1);
  --text-secondary: var(--ink-2);
  --text-muted: var(--ink-3);
  --card-shadow: var(--elev-raised);
  --card-shadow-hover: var(--elev-hover);
  --bg-grid: rgba(61, 68, 81, 0.03);
  --bg-accent-glow: 0.06;
  --bg-info-glow: 0.06;
  --scroll-thumb: #c3cad3;
  --scroll-thumb-hover: var(--shade);

  /* ===== 字体：Inter 优先，离线环境回落到系统无衬线 ===== */
  --sans-font: 'Inter', 'Nunito', 'Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei UI',
    'PingFang SC', 'Noto Sans SC', sans-serif;
  --serif-font: var(--sans-font);
  /* 数字统一等宽对齐，不再另起一套字体族 */
  --num-font: var(--sans-font);
}

/* ===== 暗色：同一束光的反向取值 ===== */
html.dark {
  --base: #262b33;
  --shade: #171b20;
  --glow: #363d47;
  --tint: #2c323b;
  --sunken: #21262d;

  --n-0: #ffffff;
  --n-50: #2c323b;
  --n-100: var(--base);
  --n-200: var(--sunken);
  --n-300: #3a414c;
  --n-400: #4a525e;
  --n-500: #77818e;
  --n-600: #97a1ae;
  --n-700: #b6bfcb;
  --n-800: #d3dae3;
  --n-900: #e8ecf2;
  --n-950: #f4f7fa;

  --surface-page: var(--base);
  --surface-card: var(--base);
  --surface-tray: var(--tint);
  --surface-sunken: var(--sunken);

  --ink-1: #e8ecf2;
  --ink-2: #b6bfcb;
  --ink-3: #97a1ae;
  --ink-4: #7b8593;
  --ink-accent: color-mix(in srgb, var(--accent-500) 70%, #ffffff);

  --line-control: #3a414c;
  --line-separator: #333a44;

  --positive: #4ecdc4;
  --negative: #ff8b8b;
  --warning: #e8b061;
  --info: #7aa8ee;

  --scrim: rgba(10, 13, 17, 0.6);

  --bg-grid: rgba(232, 236, 242, 0.02);
  --scroll-thumb: #3a414c;
  --scroll-thumb-hover: #4a525e;
  --accent-glow: rgb(var(--accent-rgb) / 0.26);
}

/* ===== 主题色：换 ramp 即可全站跟随 ===== */
html[data-accent='violet'] {
  --accent-rgb: 109 93 252;
  --accent-400: #8e80fd;
  --accent-500: #6d5dfc;
  --accent-600: #5a49e8;
  --on-accent: #ffffff;
}
html[data-accent='indigo'] {
  --accent-rgb: 76 110 245;
  --accent-400: #7d9aff;
  --accent-500: #4c6ef5;
  --accent-600: #3b57d4;
  --on-accent: #ffffff;
}
html[data-accent='teal'] {
  --accent-rgb: 14 148 136;
  --accent-400: #2fb3a7;
  --accent-500: #0e9488;
  --accent-600: #0a7a70;
  --on-accent: #ffffff;
}
html[data-accent='rose'] {
  --accent-rgb: 214 51 108;
  --accent-400: #e4638f;
  --accent-500: #d6336c;
  --accent-600: #b7275a;
  --on-accent: #ffffff;
}

/* ============================================================================
   主题二：柔和界面风（soft）

   雾灰画布 + 纯白卡片、低饱和配色、带主色相的彩色柔光阴影，交互靠「浮起」表达。
   组件都读同一批语义令牌，所以这里只覆盖令牌就能整站切换；少数新拟物专属的
   光影（键帽、内凹输入框）在组件层单独改写。

   只做亮色：规范只给了一套亮色取值，切到主题二时显示模式锁在亮色（见 theme store）。
   本块必须排在 data-accent 之后 —— 两者选择器权重相同，靠顺序压住主题色。
   ============================================================================ */
html[data-style='soft'] {
  /* 原始三色 → 雾灰 / 白 */
  --base: #f1f5f9;
  --shade: #e2e8f0;
  --glow: #ffffff;
  --tint: #f8fafc;
  --sunken: #eef2f7;

  /* 表面：页面雾灰，卡片纯白 */
  --surface-page: #f1f5f9;
  --surface-card: #ffffff;
  --surface-tray: #f8fafc;
  --surface-sunken: #eef2f7;

  /* 文字：排除纯黑，最深一档 #1f2937 */
  --n-0: #ffffff;
  --n-50: #f8fafc;
  --n-100: var(--base);
  --n-200: var(--sunken);
  --n-300: #dbe3ee;
  --n-400: #cbd5e1;
  --n-500: #94a3b8;
  --n-600: #64748b;
  --n-700: #475569;
  --n-800: #334155;
  --n-900: #1f2937;
  --n-950: #0f172a;

  --ink-1: #1f2937;
  --ink-2: #475569;
  --ink-3: #64748b;
  --ink-4: #94a3b8;

  --line-control: #e2e8f0;
  --line-separator: #e8eef6;
  --line-focus: var(--accent-500);

  /* 阴影：一律带主色相的柔光，模糊 24px 起；只有输入框保留极浅的内阴影 */
  --elev-raised: 0 12px 32px rgba(148, 163, 184, 0.25);
  --elev-raised-lg: 0 24px 48px rgba(99, 102, 241, 0.2);
  --elev-raised-sm: 0 8px 20px rgba(148, 163, 184, 0.22);
  --elev-raised-xs: 0 4px 12px rgba(148, 163, 184, 0.18);
  --elev-hover: 0 24px 48px rgba(99, 102, 241, 0.2);
  --elev-inset: inset 0 2px 6px rgba(148, 163, 184, 0.18);
  --elev-inset-sm: inset 0 2px 4px rgba(148, 163, 184, 0.16);
  --elev-well: inset 0 3px 10px rgba(148, 163, 184, 0.2);
  --elev-pressed: inset 0 4px 10px rgba(67, 56, 202, 0.28);
  --elev-float: 0 24px 56px rgba(100, 116, 139, 0.28);
  --scrim: rgba(15, 23, 42, 0.28);

  /* 状态色：低饱和，文字压深一档保证可读 */
  --positive: #0f9d78;
  --positive-rgb: 16 185 129;
  --negative: #dd5c5c;
  --negative-rgb: 239 110 110;
  --warning: #b45309;
  --warning-rgb: 245 158 11;
  --info: #4f6ef2;
  --info-rgb: 99 132 241;

  /* 品牌：规范指定的靛蓝 */
  --accent-rgb: 99 102 241;
  --accent-400: #818cf8;
  --accent-500: #6366f1;
  --accent-600: #4f46e5;
  --ink-accent: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.18);
  --btn-accent-bg: var(--accent-500);

  /* 动效：柔和本身就是被感知的时长，交互给 300ms，卡片位移给到 500ms */
  --dur-2: 200ms;
  --dur-3: 300ms;
  --dur-4: 500ms;
  --ease-out: cubic-bezier(0.27, 0.01, 0.31, 1);

  --bg-grid: rgba(100, 116, 139, 0.04);
  --scroll-thumb: #cbd5e1;
  --scroll-thumb-hover: #b6c2d2;
}

/* 物品价格分级：四档改用状态色系，避开与品牌色撞色 */
.tier-w {
  color: var(--info);
}
.tier-10w {
  color: var(--positive);
}
.tier-100w {
  color: var(--negative);
}
.tier-1000w {
  color: #8a5cc0;
}
.tier-w .el-input__inner {
  color: var(--info) !important;
}
.tier-10w .el-input__inner {
  color: var(--positive) !important;
}
.tier-100w .el-input__inner {
  color: var(--negative) !important;
}
.tier-1000w .el-input__inner {
  color: #8a5cc0 !important;
}

/* ===== Element Plus 亮色映射 ===== */
:root:not(.dark) {
  --el-color-primary: var(--accent-500);
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 75%, var(--base));
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 60%, var(--base));
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 42%, var(--base));
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 32%, var(--base));
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 14%, var(--base));
  --el-color-primary-dark-2: var(--accent-600);

  --el-color-success: var(--positive);
  --el-color-success-light-9: rgb(var(--positive-rgb) / 0.14);
  --el-color-danger: var(--negative);
  --el-color-danger-light-9: rgb(var(--negative-rgb) / 0.14);
  --el-color-error: var(--negative);
  --el-color-warning: var(--warning);
  --el-color-warning-light-9: rgb(var(--warning-rgb) / 0.14);
  --el-color-info: var(--info);
  --el-color-info-light-9: rgb(var(--info-rgb) / 0.12);

  --el-bg-color: var(--surface-card);
  --el-bg-color-page: var(--surface-page);
  --el-bg-color-overlay: var(--surface-card);
  --el-fill-color-blank: var(--surface-card);
  --el-fill-color: var(--surface-sunken);
  --el-fill-color-light: var(--surface-tray);
  --el-fill-color-lighter: var(--surface-tray);
  --el-fill-color-dark: var(--sunken);
  --el-fill-color-darker: var(--shade);

  --el-border-color: var(--line-separator);
  --el-border-color-light: var(--line-separator);
  --el-border-color-lighter: var(--line-separator);
  --el-border-color-extra-light: var(--line-separator);
  --el-border-color-dark: var(--line-control);
  --el-border-color-darker: var(--shade);
  --el-border-color-hover: var(--accent-500);

  --el-text-color-primary: var(--ink-1);
  --el-text-color-regular: var(--ink-2);
  --el-text-color-secondary: var(--ink-3);
  --el-text-color-placeholder: var(--ink-4);
  --el-text-color-disabled: var(--n-500);

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 12px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: var(--scrim);
  --el-box-shadow: var(--elev-float);
  --el-box-shadow-light: var(--elev-raised);
  --el-box-shadow-lighter: var(--elev-raised-sm);

  /* 表格：只留横向凹槽线，表头是安静的小字标签 */
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
  --el-color-primary-light-3: color-mix(in srgb, var(--accent-500) 78%, var(--base));
  --el-color-primary-light-5: color-mix(in srgb, var(--accent-500) 62%, var(--base));
  --el-color-primary-light-7: color-mix(in srgb, var(--accent-500) 42%, var(--base));
  --el-color-primary-light-8: color-mix(in srgb, var(--accent-500) 32%, var(--base));
  --el-color-primary-light-9: color-mix(in srgb, var(--accent-500) 18%, var(--base));
  --el-color-primary-dark-2: var(--accent-400);

  --el-color-success: var(--positive);
  --el-color-success-light-9: rgb(var(--positive-rgb) / 0.16);
  --el-color-danger: var(--negative);
  --el-color-danger-light-9: rgb(var(--negative-rgb) / 0.16);
  --el-color-error: var(--negative);
  --el-color-warning: var(--warning);
  --el-color-warning-light-9: rgb(var(--warning-rgb) / 0.16);
  --el-color-info: var(--info);
  --el-color-info-light-9: rgb(var(--info-rgb) / 0.16);

  --el-bg-color: var(--surface-card);
  --el-bg-color-page: var(--surface-page);
  --el-bg-color-overlay: var(--surface-card);
  --el-fill-color-blank: var(--surface-card);
  --el-fill-color: var(--surface-sunken);
  --el-fill-color-light: var(--surface-tray);
  --el-fill-color-lighter: var(--surface-tray);
  --el-fill-color-dark: var(--sunken);
  --el-fill-color-darker: var(--shade);

  --el-border-color: var(--line-separator);
  --el-border-color-light: var(--line-separator);
  --el-border-color-lighter: var(--line-control);
  --el-border-color-extra-light: var(--line-control);
  --el-border-color-dark: var(--line-control);
  --el-border-color-darker: var(--shade);
  --el-border-color-hover: var(--ink-accent);

  --el-text-color-primary: var(--ink-1);
  --el-text-color-regular: var(--ink-2);
  --el-text-color-secondary: var(--ink-3);
  --el-text-color-placeholder: var(--ink-4);
  --el-text-color-disabled: var(--n-500);

  --el-border-radius-base: var(--radius-control);
  --el-border-radius-small: 12px;
  --el-border-radius-round: var(--radius-pill);
  --el-mask-color: var(--scrim);
  --el-box-shadow: var(--elev-float);
  --el-box-shadow-light: var(--elev-raised);
  --el-box-shadow-lighter: var(--elev-raised-sm);

  --el-table-border-color: var(--line-separator);
  --el-table-border: 1px solid var(--line-separator);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-header-text-color: var(--ink-3);
  --el-table-text-color: var(--ink-1);
  --el-table-row-hover-bg-color: var(--surface-tray);
}

/* ============================================================================
   基础元素
   ============================================================================ */

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

/* 页面底就是所有元素的底色：材质连续，没有底色差 */
body {
  color: var(--ink-1);
  font: var(--text-body);
  font-family: var(--sans-font);
  background: var(--surface-page);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--sans-font);
  color: var(--ink-1);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
}
h1 {
  font: var(--text-title-1);
  font-family: var(--sans-font);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
}
h2 {
  font: var(--text-title-2);
  font-family: var(--sans-font);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
}
h3,
h4,
h5,
h6 {
  font: var(--text-title-3);
  font-family: var(--sans-font);
  font-weight: 500;
  letter-spacing: var(--tracking-tight);
}

.card-title {
  font: var(--text-headline);
  font-family: var(--sans-font);
  font-weight: 500;
  letter-spacing: var(--tracking-normal);
  color: var(--ink-1);
}

/* 焦点环：紫罗兰外描边，偏移 3px */
:where(button, [role='button'], a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--line-focus);
  outline-offset: 3px;
}

/* 滚动条：凹槽里的细条 */
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

.num {
  font-family: var(--num-font);
  font-variant-numeric: tabular-nums;
}

/* 路由过渡：淡入 + 轻微缩放 + 2px 模糊；退场更快 */
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

/* ============================================================================
   Element Plus 组件重制：凸起 / 凹陷，无描边
   ============================================================================ */

/* ----- 输入类：与底色同色，只靠内阴影表达凹陷 ----- */
.el-input__wrapper,
.el-textarea__inner,
.el-select__wrapper,
.el-range-editor.el-input__wrapper {
  background-color: var(--surface-card) !important;
  border-radius: var(--radius-control);
  box-shadow: var(--elev-inset) !important;
  transition: box-shadow var(--dur-3) var(--ease-out);
}
.el-textarea__inner {
  padding: 8px 12px;
}
.el-select__wrapper {
  padding: 4px 12px;
}
/* 悬停：阴影略微收窄，暗示手靠近 */
.el-input__wrapper:hover,
.el-textarea__inner:hover,
.el-select__wrapper:hover {
  box-shadow: var(--elev-inset-sm) !important;
}
/* 聚焦：保持凹陷，只把阴影色相转向紫罗兰 */
.el-input__wrapper.is-focus,
.el-textarea__inner:focus,
.el-select__wrapper.is-focused {
  box-shadow:
    inset 3px 3px 8px color-mix(in srgb, var(--shade) 78%, var(--accent-500)),
    inset -3px -3px 8px var(--glow),
    0 0 0 2px rgb(var(--accent-rgb) / 0.18) !important;
}
.el-input.is-disabled .el-input__wrapper,
.el-textarea.is-disabled .el-textarea__inner,
.el-select__wrapper.is-disabled {
  box-shadow: var(--elev-inset-sm) !important;
  opacity: 0.55;
}
.el-input__inner,
.el-textarea__inner,
.el-select__selected-item {
  color: var(--ink-1);
}
.el-input__inner::placeholder,
.el-textarea__inner::placeholder {
  color: var(--ink-4);
}
/* 数字输入的分段按钮 */
.el-input-number__decrease,
.el-input-number__increase {
  background: transparent;
  color: var(--ink-3);
  border-color: var(--line-separator);
}

/* ----- 按钮：凸起 → 悬停模糊减半 → 按下翻成凹陷 ----- */
.el-button {
  --el-button-bg-color: var(--surface-card);
  --el-button-border-color: transparent;
  --el-button-hover-bg-color: var(--surface-card);
  --el-button-hover-border-color: transparent;
  --el-button-active-bg-color: var(--surface-card);
  --el-button-active-border-color: transparent;
  --el-button-text-color: var(--ink-1);
  --el-button-hover-text-color: var(--ink-1);
  --el-button-active-text-color: var(--ink-1);
  border: 0;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  color: var(--ink-1);
  font-weight: 500;
  box-shadow: var(--elev-raised-sm);
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    color var(--dur-2) ease,
    background-color var(--dur-2) ease;
}
.el-button:hover {
  box-shadow: var(--elev-hover);
  color: var(--ink-1);
}
.el-button:active,
.el-button.is-active {
  box-shadow: var(--elev-pressed);
  transform: none;
}
.el-button.is-disabled,
.el-button.is-disabled:hover {
  box-shadow: var(--elev-raised-xs);
  opacity: 0.5;
}
.el-button--small {
  border-radius: 12px;
}
.el-button.is-link,
.el-button.is-text {
  box-shadow: none;
  background: transparent;
}
.el-button.is-link:hover,
.el-button.is-text:hover {
  box-shadow: none;
  background: var(--surface-tray);
}

/* 主行动：全系统唯一允许压在基底上的饱和色 */
.el-button--primary {
  --el-button-text-color: var(--on-accent);
  --el-button-hover-text-color: var(--on-accent);
  --el-button-active-text-color: var(--on-accent);
  --el-button-hover-bg-color: var(--accent-500);
  --el-button-active-bg-color: var(--accent-600);
  --el-button-bg-color: var(--accent-500);
  background: var(--accent-500);
  border: 0;
  color: var(--on-accent);
  box-shadow: 0 3px 12px rgb(var(--accent-rgb) / 0.3);
  font-weight: 600;
}
.el-button--primary:not(.is-disabled):hover {
  box-shadow: 0 5px 18px rgb(var(--accent-rgb) / 0.42);
  color: var(--on-accent);
  background: var(--accent-500);
}
.el-button--primary:not(.is-disabled):active {
  background: var(--accent-600);
  box-shadow: 0 1px 6px rgb(var(--accent-rgb) / 0.3);
  transform: none;
}
.el-button--danger {
  --el-button-bg-color: var(--negative);
  --el-button-hover-bg-color: var(--negative);
  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  background: var(--negative);
  box-shadow: 0 3px 12px rgb(var(--negative-rgb) / 0.32);
}
.el-button-group .el-button:not(:first-child) {
  margin-left: 6px;
}

/* ----- 表格：横向凹槽线，无竖线，表头是安静标签 ----- */
.el-table {
  background: transparent;
  color: var(--ink-1);
  --el-table-border-color: var(--line-separator);
}
.el-table th.el-table__cell {
  background: transparent;
  font: var(--text-label);
  font-family: var(--sans-font);
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--ink-3);
}
.el-table td.el-table__cell {
  border-bottom: 1px solid var(--line-separator);
}
.el-table::before,
.el-table__inner-wrapper::before {
  display: none;
}
.el-table__empty-block {
  background: transparent;
}
.el-table__empty-text {
  color: var(--ink-4);
}
.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell {
  background: var(--surface-tray);
}

/* ----- 弹层：抬起的面板 ----- */
.el-dialog {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  box-shadow: var(--elev-float);
  padding: 22px 24px 24px;
}
.el-dialog__header {
  padding: 0 0 14px;
  margin-right: 0;
}
.el-dialog__title {
  font: var(--text-subheading);
  font-family: var(--sans-font);
  font-weight: 500;
  color: var(--ink-1);
}
.el-dialog__body {
  padding: 0;
  color: var(--ink-2);
}
.el-dialog__footer {
  padding: 18px 0 0;
}
.el-overlay {
  backdrop-filter: blur(4px);
}
.el-message-box {
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  box-shadow: var(--elev-float);
}
.el-message-box__title {
  font: var(--text-subheading);
  font-family: var(--sans-font);
  font-weight: 500;
}
.el-popper.is-light,
.el-popper.is-dark {
  background: var(--surface-card);
  border: 0 !important;
  border-radius: 16px;
  box-shadow: var(--elev-float);
  color: var(--ink-1);
}
.el-popper.is-light .el-popper__arrow::before,
.el-popper.is-dark .el-popper__arrow::before {
  background: var(--surface-card);
  border: 0 !important;
  box-shadow: none;
}
.el-popper.is-dark {
  --el-text-color-primary: var(--ink-1);
}
.el-dropdown-menu {
  background: transparent;
  padding: 6px;
}
.el-dropdown-menu__item {
  border-radius: 10px;
  color: var(--ink-2);
}
.el-dropdown-menu__item:not(.is-disabled):focus,
.el-dropdown-menu__item:not(.is-disabled):hover {
  background: var(--surface-tray);
  color: var(--ink-1);
}
.el-select-dropdown__item.is-selected {
  color: var(--accent-500);
  font-weight: 600;
}
.el-select-dropdown__item.is-hovering {
  background: var(--surface-tray);
}
.el-notification,
.el-message {
  background: var(--surface-card);
  border: 0;
  border-radius: 18px;
  box-shadow: var(--elev-float);
}

/* ----- 标签与徽标：胶囊、平涂，不描边 ----- */
.el-tag {
  border: 0;
  border-radius: var(--radius-pill);
  --el-tag-border-radius: var(--radius-pill);
  font-weight: 500;
}
.el-tag--primary {
  --el-tag-bg-color: rgb(var(--accent-rgb) / 0.12);
  --el-tag-text-color: var(--accent-600);
  --el-tag-border-color: transparent;
}
.el-tag--success {
  --el-tag-bg-color: rgb(var(--positive-rgb) / 0.16);
  --el-tag-text-color: var(--positive);
  --el-tag-border-color: transparent;
}
.el-tag--danger {
  --el-tag-bg-color: rgb(var(--negative-rgb) / 0.16);
  --el-tag-text-color: var(--negative);
  --el-tag-border-color: transparent;
}
.el-tag--warning {
  --el-tag-bg-color: rgb(var(--warning-rgb) / 0.18);
  --el-tag-text-color: var(--warning);
  --el-tag-border-color: transparent;
}
.el-tag--info {
  --el-tag-bg-color: rgb(var(--info-rgb) / 0.14);
  --el-tag-text-color: var(--info);
  --el-tag-border-color: transparent;
}

/* ----- 分段控件：凹槽轨道 + 凸起的选中滑块 ----- */
.el-segmented {
  --el-segmented-bg-color: transparent;
  --el-segmented-color: var(--ink-3);
  --el-segmented-item-selected-bg-color: var(--surface-card);
  --el-segmented-item-selected-color: var(--accent-600);
  --el-segmented-item-hover-bg-color: transparent;
  --el-segmented-item-hover-color: var(--ink-1);
  --el-segmented-item-active-bg-color: transparent;
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-control);
  box-shadow: var(--elev-inset-sm);
  padding: 3px;
}
.el-segmented__item-selected {
  background: var(--surface-card);
  border-radius: 11px;
  box-shadow: var(--elev-raised-xs);
}
html.dark .el-segmented {
  --el-segmented-item-selected-color: var(--ink-accent);
}

/* ----- 单选按钮组：一排键帽，选中即按下 ----- */
.el-radio-button__inner {
  background: var(--surface-card);
  border: 0 !important;
  border-radius: var(--radius-control) !important;
  box-shadow: var(--elev-raised-xs);
  color: var(--ink-2);
  font-weight: 500;
  margin: 0 3px;
  transition:
    box-shadow var(--dur-3) var(--ease-out),
    color var(--dur-2) ease;
}
.el-radio-button__inner:hover {
  box-shadow: var(--elev-hover);
  color: var(--ink-1);
}
.el-radio-button__original-radio:checked + .el-radio-button__inner {
  background: var(--surface-card);
  color: var(--accent-600);
  box-shadow: var(--elev-pressed);
}

/* ----- 开关：轨道凹陷、旋钮凸起 ----- */
.el-switch__core {
  background: var(--surface-sunken) !important;
  border: 0 !important;
  box-shadow: var(--elev-inset-sm);
}
.el-switch.is-checked .el-switch__core {
  background: var(--accent-500) !important;
  box-shadow: inset 2px 2px 6px rgb(0 0 0 / 0.22);
}
.el-switch__core .el-switch__action {
  background: var(--n-0);
  box-shadow: var(--elev-raised-xs);
}
/*
 * EP 的开关内联提示文字两态都写死白字，关闭态白字压在浅色滑轨上看不见，
 * 只有关闭态需要改回深色。
 */
.el-switch__core .el-switch__inner-wrapper {
  color: var(--ink-2);
}
.el-switch.is-checked .el-switch__core .el-switch__inner-wrapper {
  color: var(--on-accent);
}

/* ----- 复选 / 单选：凹槽 + 品牌色勾选 ----- */
.el-checkbox__inner,
.el-radio__inner {
  background: var(--surface-card);
  border: 0;
  box-shadow: var(--elev-inset-sm);
}
.el-checkbox__input.is-checked .el-checkbox__inner,
.el-radio__input.is-checked .el-radio__inner {
  background: var(--accent-500);
  box-shadow: inset 1px 1px 3px rgb(0 0 0 / 0.25);
}

/* ----- 标签页：选中走品牌色，指示条做凹槽 ----- */
.el-tabs__item {
  color: var(--ink-3);
  font-weight: 500;
}
.el-tabs__item.is-active {
  color: var(--accent-500);
  font-weight: 600;
}
.el-tabs__active-bar {
  background-color: var(--accent-500);
  height: 2px;
  border-radius: 2px;
}
.el-tabs__nav-wrap::after {
  background-color: var(--line-separator);
  height: 1px;
}

/* ----- 分页：一排小键帽 ----- */
.el-pagination.is-background .el-pager li,
.el-pagination.is-background .btn-prev,
.el-pagination.is-background .btn-next {
  background: var(--surface-card);
  color: var(--ink-2);
  border-radius: 12px;
  box-shadow: var(--elev-raised-xs);
}
.el-pagination.is-background .el-pager li.is-active {
  background: var(--surface-card);
  color: var(--accent-600);
  box-shadow: var(--elev-pressed);
}

/* ----- 其他小件 ----- */
.el-divider {
  border-color: var(--line-separator);
}
.el-empty__description p {
  color: var(--ink-4);
}
.el-form-item__label {
  color: var(--ink-2);
}
.el-tooltip__popper.is-dark {
  background: var(--surface-card);
  color: var(--ink-1);
}
.el-loading-mask {
  background-color: color-mix(in srgb, var(--base) 72%, transparent);
}

/* ============================================================================
   主题二：组件层改写

   新拟物靠内阴影和同色面表达层级，柔和界面风靠白面、彩色柔光和位移表达，
   所以这几处不能只换令牌，得改写光影本身。只作用于 data-style=soft。
   ============================================================================ */

/* 卡片：悬停上浮并换成主色柔光（规范 4~8px，桌面密集布局取 4px） */
html[data-style='soft'] .card {
  transition:
    transform var(--dur-4) var(--ease-out),
    box-shadow var(--dur-4) var(--ease-out);
}
html[data-style='soft'] .card:hover {
  transform: translateY(-4px);
  box-shadow: 0 24px 48px rgba(99, 102, 241, 0.2);
}

/* 按钮：静置柔光 → 悬停上浮 → 按下内凹并轻微缩放 */
html[data-style='soft'] .el-button {
  background: var(--surface-card);
  box-shadow: 0 8px 20px rgba(148, 163, 184, 0.2);
  transition:
    box-shadow var(--dur-3) ease,
    transform var(--dur-3) ease,
    background-color var(--dur-2) ease,
    color var(--dur-2) ease;
}
html[data-style='soft'] .el-button:not(.is-disabled):not(.is-link):not(.is-text):hover {
  color: var(--ink-1);
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(100, 116, 139, 0.24);
}
html[data-style='soft'] .el-button:not(.is-disabled):not(.is-link):not(.is-text):active {
  transform: translateY(0) scale(0.97);
  box-shadow: inset 0 3px 8px rgba(100, 116, 139, 0.22);
}
html[data-style='soft'] .el-button.is-disabled {
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.16);
}
/* 只给实心主按钮加柔光与浮起；is-link / is-text 仍按文字链处理，避免「全部」
   这类文字按钮被撑成紫色胶囊。 */
html[data-style='soft'] .el-button--primary:not(.is-link):not(.is-text) {
  background: var(--accent-500);
  color: var(--on-accent);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.25);
}
html[data-style='soft'] .el-button--primary:not(.is-link):not(.is-text):not(.is-disabled):hover {
  background: var(--accent-500);
  color: var(--on-accent);
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(99, 102, 241, 0.35);
}
html[data-style='soft'] .el-button--primary:not(.is-link):not(.is-text):not(.is-disabled):active {
  background: var(--accent-600);
  color: var(--on-accent);
  transform: scale(0.96);
  box-shadow: inset 0 4px 10px rgba(67, 56, 202, 0.28);
}
html[data-style='soft'] .el-button.is-link,
html[data-style='soft'] .el-button.is-text {
  background: transparent;
  box-shadow: none;
}
html[data-style='soft'] .el-button.is-link:hover,
html[data-style='soft'] .el-button.is-text:hover {
  box-shadow: none;
}
/* 危险按钮必须重新声明底色：上面的 .el-button 白底优先级更高，只给文字色会变成白字白底 */
html[data-style='soft'] .el-button--danger:not(.is-link):not(.is-text) {
  background: var(--negative);
  color: #fff;
  box-shadow: 0 10px 24px rgba(221, 92, 92, 0.25);
}
html[data-style='soft'] .el-button--danger:not(.is-link):not(.is-text):not(.is-disabled):hover {
  background: var(--negative);
  color: #fff;
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(221, 92, 92, 0.35);
}
html[data-style='soft'] .el-button--danger:not(.is-link):not(.is-text):not(.is-disabled):active {
  background: var(--negative);
  color: #fff;
  transform: scale(0.96);
  box-shadow: inset 0 4px 10px rgba(160, 47, 47, 0.32);
}

/* 输入：雾灰填充、无描边；聚焦转白 + 4px 外环 + 柔光，尺寸不变 */
html[data-style='soft'] .el-input__wrapper,
html[data-style='soft'] .el-textarea__inner,
html[data-style='soft'] .el-select__wrapper,
html[data-style='soft'] .el-range-editor.el-input__wrapper {
  background-color: var(--sunken) !important;
  border-radius: var(--radius-control);
  box-shadow: none !important;
  transition:
    background-color var(--dur-3) ease,
    box-shadow var(--dur-3) ease;
}
html[data-style='soft'] .el-input__wrapper:hover,
html[data-style='soft'] .el-textarea__inner:hover,
html[data-style='soft'] .el-select__wrapper:hover {
  background-color: #e8eef7 !important;
  box-shadow: none !important;
}
html[data-style='soft'] .el-input__wrapper.is-focus,
html[data-style='soft'] .el-textarea__inner:focus,
html[data-style='soft'] .el-select__wrapper.is-focused {
  background-color: var(--surface-card) !important;
  box-shadow:
    0 0 0 4px rgba(99, 102, 241, 0.2),
    0 10px 26px rgba(99, 102, 241, 0.14) !important;
}
html[data-style='soft'] .el-input.is-disabled .el-input__wrapper,
html[data-style='soft'] .el-select__wrapper.is-disabled {
  background-color: var(--surface-tray) !important;
  box-shadow: none !important;
}

/* 开关：雾灰轨道，选中是靛蓝 + 主色柔光 */
html[data-style='soft'] .el-switch__core {
  background: var(--sunken) !important;
  box-shadow: none !important;
}
html[data-style='soft'] .el-switch.is-checked .el-switch__core {
  background: var(--accent-500) !important;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3) !important;
}
html[data-style='soft'] .el-switch__core .el-switch__action {
  box-shadow: 0 2px 6px rgba(100, 116, 139, 0.25);
}

/* 复选 / 单选：白底 + 一圈浅灰内描边，选中是靛蓝实心 */
html[data-style='soft'] .el-checkbox__inner,
html[data-style='soft'] .el-radio__inner {
  background: var(--surface-card);
  box-shadow: inset 0 0 0 1.5px var(--line-control) !important;
}
html[data-style='soft'] .el-checkbox__input.is-checked .el-checkbox__inner,
html[data-style='soft'] .el-radio__input.is-checked .el-radio__inner {
  background: var(--accent-500);
  box-shadow: none !important;
}

/* 分段控件：雾灰轨道 + 白色滑块 */
html[data-style='soft'] .el-segmented {
  background: var(--sunken);
  box-shadow: none;
}
html[data-style='soft'] .el-segmented__item-selected {
  background: var(--surface-card);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.25);
}

/* 单选键帽 / 分页：去掉新拟物的内凹，换成白面 + 柔光 */
html[data-style='soft'] .el-radio-button__inner {
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.18);
}
html[data-style='soft'] .el-radio-button__original-radio:checked + .el-radio-button__inner {
  color: var(--accent-600);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2);
}
html[data-style='soft'] .el-pagination.is-background .el-pager li,
html[data-style='soft'] .el-pagination.is-background .btn-prev,
html[data-style='soft'] .el-pagination.is-background .btn-next {
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.18);
}
html[data-style='soft'] .el-pagination.is-background .el-pager li.is-active {
  color: var(--accent-600);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2);
}

/* 减少动态效果：位移与缩放全部取消，只保留颜色变化 */
@media (prefers-reduced-motion: reduce) {
  html[data-style='soft'] .card,
  html[data-style='soft'] .card:hover,
  html[data-style='soft'] .el-button,
  html[data-style='soft'] .el-button:not(.is-disabled):hover,
  html[data-style='soft'] .el-button:not(.is-disabled):active {
    transition: none;
    transform: none;
  }
}
</style>

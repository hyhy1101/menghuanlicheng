<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { cssVar } from '../utils/theme'
import { useThemeStore } from '../stores/theme'

/** 横向对比条目：name 为分类名，value 为待比较的数值 */
export interface CompareBarItem {
  name: string
  value: number
}

const props = withDefaults(
  defineProps<{
    items: CompareBarItem[]
    height?: number
    /** 数值格式化；图表标签与 tooltip 共用 */
    valueFormatter?: (value: number) => string
    /** 负值向左并显示为警示色（净收益可能为负） */
    diverging?: boolean
    /** 左侧分类名的最大宽度，超长截断 */
    labelWidth?: number
  }>(),
  {
    height: 300,
    valueFormatter: (v: number) => v.toLocaleString('zh-CN'),
    diverging: false,
    labelWidth: 88
  }
)

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  chart ??= echarts.init(el.value)

  // canvas 不解析 CSS 变量，先取计算值
  const accent500 = cssVar('--accent-500')
  const negative = cssVar('--negative')
  const tooltipBg = cssVar('--el-bg-color-overlay')
  const tooltipBorder = cssVar('--el-border-color')
  const textPrimary = cssVar('--el-text-color-primary')
  const textSecondary = cssVar('--el-text-color-secondary')
  const textMuted = cssVar('--el-text-color-placeholder')
  const axisLine = cssVar('--el-border-color')
  const fmt = props.valueFormatter

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      borderRadius: 10,
      padding: [10, 14],
      textStyle: { color: textPrimary, fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0]
        if (!p) return ''
        return `${p.name}<br/><b style="color:${accent500}">${fmt(Number(p.value))}</b>`
      }
    },
    grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: textMuted, fontSize: 11, formatter: (v: number) => fmt(v) },
      splitLine: { lineStyle: { color: axisLine } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: props.items.map((i) => i.name),
      axisLine: { lineStyle: { color: axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: textSecondary,
        fontSize: 12,
        width: props.labelWidth,
        overflow: 'truncate'
      }
    },
    series: [
      {
        type: 'bar',
        data: props.items.map((i) => ({
          value: i.value,
          itemStyle: {
            color: props.diverging && i.value < 0 ? negative : accent500,
            borderRadius: [0, 4, 4, 0]
          }
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: textSecondary,
          fontSize: 11,
          formatter: (p: { value: number }) => fmt(Number(p.value))
        },
        emphasis: { itemStyle: { opacity: 0.85 } }
      }
    ]
  })
}

watch(() => props.items, render, { deep: true })
watch(() => [props.height, props.diverging, props.labelWidth], render)

const theme = useThemeStore()
watch(() => [theme.mode, theme.accent], render)

function resize() {
  chart?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="compare-chart" :style="{ height: `${height}px` }" />
</template>

<style scoped>
.compare-chart {
  width: 100%;
}
</style>

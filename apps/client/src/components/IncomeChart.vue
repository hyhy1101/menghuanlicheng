<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { IncomeTrendPoint } from '@lc/shared'
import { cssVar } from '../utils/theme'
import { useThemeStore } from '../stores/theme'

const props = defineProps<{ points: IncomeTrendPoint[] }>()

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  chart ??= echarts.init(el.value)
  const dates = props.points.map((p) => p.date.slice(5))
  // 主题颜色跟随当前 mode/accent（canvas 不解析 var()，需先取计算值）
  // --accent-rgb 是空格分隔的「109 93 252」；canvas 的 rgba() 只认逗号分隔，
  // 直接拼会得到 rgba(109 93 252, 0.22) 并抛 SyntaxError，把整个页面卡住
  const accentRgb = cssVar('--accent-rgb')
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(', ')
  const accent = (alpha: number) => `rgba(${accentRgb}, ${alpha})`
  const accent400 = cssVar('--accent-400')
  const accent500 = cssVar('--accent-500')
  const positive = cssVar('--positive')
  const tooltipBg = cssVar('--el-bg-color-overlay')
  const tooltipBorder = cssVar('--el-border-color')
  const textPrimary = cssVar('--el-text-color-primary')
  const textSecondary = cssVar('--el-text-color-secondary')
  const textMuted = cssVar('--el-text-color-placeholder')
  const axisLine = cssVar('--el-border-color')
  chart.setOption({
    backgroundColor: 'transparent',
    color: [accent500, positive],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      borderRadius: 10,
      padding: [10, 14],
      textStyle: { color: textPrimary, fontSize: 12 },
      formatter: (params: { seriesName: string; value: number; dataIndex: number }[]) => {
        const p = props.points[params[0].dataIndex]
        return [
          `<b style="color:${accent400}">${p.date}</b>`,
          `总收益：<span style="color:${accent500};font-weight:600">${(p.totalIncome / 10000).toLocaleString()}万</span>`,
          `净收益：<span style="color:${positive};font-weight:600">${(p.netIncome / 10000).toLocaleString()}万</span>`,
          `时长：${(p.durationMinutes / 60).toFixed(1)}h · ${p.recordCount}条记录`
        ].join('<br/>')
      }
    },
    legend: {
      data: ['总收益', '净收益'],
      textStyle: { color: textSecondary, fontSize: 12 },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 3,
      top: 0
    },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: textMuted, fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textMuted,
        fontSize: 11,
        formatter: (v: number) => `${(v / 10000).toFixed(0)}万`
      },
      splitLine: { lineStyle: { color: axisLine } }
    },
    series: [
      {
        name: '总收益',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: accent500 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: accent(0.22) },
          { offset: 1, color: accent(0) }
        ]) },
        data: props.points.map((p) => p.totalIncome)
      },
      {
        name: '净收益',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: positive },
        data: props.points.map((p) => p.netIncome)
      }
    ]
  })
}

watch(() => props.points, render, { deep: true })

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
  <div ref="el" class="chart" />
</template>

<style scoped>
.chart {
  height: 260px;
  width: 100%;
}
</style>

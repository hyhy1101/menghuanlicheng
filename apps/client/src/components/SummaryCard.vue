<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordStore } from '../stores/record'
import { fmtWan } from '../utils/format'

const router = useRouter()
const store = useRecordStore()

const summary = computed(() => store.lastSummary)
const fmt = fmtWan

function copy() {
  navigator.clipboard.writeText(store.shareText)
}

function close() {
  store.setShare('', null)
  void router.push('/')
}
</script>

<template>
  <div v-if="summary" class="overlay">
    <div class="card">
      <div class="ok">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        里程已保存
      </div>
      <div class="net-label">净收益</div>
      <div class="net-value num" :class="summary.netIncome >= 0 ? 'up' : 'down'">
        {{ summary.netIncome >= 0 ? '+' : '' }}{{ fmt(summary.netIncome) }}<span class="unit">万</span>
      </div>
      <div class="grid">
        <div class="kv"><span>时长</span><b class="num">{{ (summary.durationMinutes / 60).toFixed(1) }}h</b></div>
        <div class="kv"><span>总收益</span><b class="num gold">{{ fmt(summary.totalIncome) }}万</b></div>
        <div class="kv"><span>净收益</span><b class="num green">{{ fmt(summary.netIncome) }}万</b></div>
        <div class="kv"><span>效率</span><b class="num">{{ fmt(summary.netEfficiency) }}万/h</b></div>
      </div>
      <div class="share-box">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8h16v-8M12 3v12M8 7l4-4 4 4" />
        </svg>
        {{ store.shareText }}
      </div>
      <div class="actions">
        <el-button type="primary" class="btn-gold" @click="copy">复制分享</el-button>
        <el-button class="btn-ghost" @click="close">完成</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.card {
  position: relative;
  width: 440px;
  background: var(--surface-card);
  border: 0;
  border-radius: var(--radius-card);
  padding: 32px 28px 28px;
  text-align: center;
  box-shadow: var(--elev-float);
  overflow: hidden;
  animation: pop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes pop {
  from { transform: scale(0.92) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.ok {
  color: var(--positive);
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-bottom: 10px;
}
.net-label {
  color: var(--text-muted);
  font-size: 13px;
}
.net-value {
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 1.2;
  margin-bottom: 18px;
}
.net-value .unit {
  font-size: 20px;
  font-weight: 600;
  margin-left: 3px;
}
.net-value.up {
  color: var(--accent-500);
  text-shadow: 0 0 30px rgb(var(--accent-rgb) / 0.4);
}
.net-value.down {
  color: var(--negative);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
.kv {
  background: var(--surface-card);
  border: 0;
  border-radius: 14px;
  padding: 12px;
  box-shadow: var(--elev-inset-sm);
}
.kv span {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 3px;
}
.kv b {
  font-size: 15px;
}
.gold {
  color: var(--accent-500);
}
.green {
  color: var(--positive);
}
.share-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--surface-card);
  border: 0;
  border-radius: 14px;
  padding: 12px;
  box-shadow: var(--elev-inset-sm);
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 18px;
  line-height: 1.6;
}
.share-box svg {
  flex-shrink: 0;
  color: var(--accent-500);
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.btn-gold,
.btn-ghost {
  margin: 0;
  height: 44px;
  padding: 0 24px;
  border-radius: var(--radius-control);
  border: none;
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-gold {
  background: var(--accent-500);
  color: var(--on-accent);
  box-shadow: 0 4px 16px rgb(var(--accent-rgb) / 0.32);
}
.btn-gold:hover {
  box-shadow: 0 6px 22px rgb(var(--accent-rgb) / 0.45);
  background: var(--accent-500);
  color: var(--on-accent);
}
.btn-gold:active {
  background: var(--accent-600);
  box-shadow: 0 1px 6px rgb(var(--accent-rgb) / 0.3);
}
.btn-ghost {
  background: var(--surface-card);
  border: 0;
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
</style>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ confirm: [payload: CostPayload] }>()

/** 只描述「一笔损耗」，quantity / sourceId / direction 由调用方按接口约定补齐 */
export interface CostPayload {
  /** 损耗名称，自由填写（修理费、巫医……） */
  itemName: string
  /** 总金额（两） */
  unitPrice: number
}

const costName = ref('')
const totalPrice = ref(0)
const errorMsg = ref('')

/**
 * 损耗不选物品、不归任何活动，只记「名称 + 总金额」一笔。
 * 收获已改由记账页右侧的物品点选面板录入（点图标 +1），不再走这里。
 */
function confirm() {
  const name = costName.value.trim()
  if (!name) {
    errorMsg.value = '请填写损耗名称'
    return
  }
  if (!(totalPrice.value > 0)) {
    errorMsg.value = '请输入损耗金额'
    return
  }
  errorMsg.value = ''
  emit('confirm', { itemName: name, unitPrice: totalPrice.value })
}
</script>

<template>
  <div class="cost-form">
    <div class="cost-form-header">
      <span class="title">添加损耗（负向）</span>
    </div>

    <div class="cost-fields">
      <div class="cost-field">
        <span class="cost-label">损耗名称</span>
        <el-input v-model="costName" placeholder="如：修理费、巫医" clearable autofocus />
      </div>
      <div class="cost-field">
        <span class="cost-label">总价（两）</span>
        <el-input-number v-model="totalPrice" :min="0" :controls="false" class="cost-input" />
      </div>
      <p class="cost-tip">损耗不选物品、不归任何活动，只记一笔金额</p>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="warning" show-icon :closable="false" />

    <div class="confirm-row">
      <span class="push" />
      <el-button type="primary" class="btn-gold" @click="confirm">确认</el-button>
    </div>
  </div>
</template>

<style scoped>
.cost-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}
.cost-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.title::before {
  content: '';
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--btn-accent-bg);
  box-shadow: 0 0 8px rgb(var(--accent-rgb) / 0.5);
}
/* ---- 损耗：只有名称 + 总价 ---- */
.cost-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.cost-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cost-label {
  width: 76px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.cost-field :deep(.el-input__wrapper) {
  height: 40px;
  border-radius: var(--radius-control);
}
.cost-input {
  flex: 1;
  width: auto;
}
.cost-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.confirm-row .push {
  flex: 1;
}
.btn-gold {
  height: 40px;
  margin: 0;
  padding: 0 20px;
  font-weight: 600;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  border: none;
  color: var(--on-accent);
  box-shadow: 0 3px 14px rgb(var(--accent-rgb) / 0.3);
}
.btn-gold:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 20px rgb(var(--accent-rgb) / 0.42);
  background: var(--btn-accent-bg);
  color: var(--on-accent);
}
</style>
